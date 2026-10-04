import test from "node:test";
import assert from "node:assert/strict";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { buildServer } from "../dist/mcp.js";
import { VERSION } from "../dist/index.js";
import { contracts } from "./contracts.mjs";

async function connect(t, options) {
  const server = buildServer(options);
  const client = new McpClient({ name: "test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}

test("all 40 tools advertise schemas and execute over the MCP protocol", async (t) => {
  let current;
  const client = await connect(t, {
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      const [name, , , , path, query, body] = current;
      assert.equal(url.pathname, path);
      const expected = new URLSearchParams();
      for (const [k, v] of Object.entries(query))
        for (const item of Array.isArray(v) ? v : [v]) expected.append(k, item);
      expected.sort();
      const actual = new URLSearchParams(url.search);
      actual.sort();
      assert.equal(actual.toString(), expected.toString());
      assert.equal(init.method, body ? "POST" : "GET");
      if (body) assert.deepEqual(JSON.parse(init.body), body);
      return name === "panorama_report_csv"
        ? new Response("a;b\n1;2")
        : Response.json({
            preview: true,
            total_capped: true,
            avisos: ["preserved"],
          });
    },
  });
  assert.equal(client.getServerVersion().version, VERSION);
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    contracts.map((t) => t[0]).sort(),
  );
  assert.equal(
    tools.find((t) => t.name === "search_companies").inputSchema.properties
      .query.minLength,
    4,
  );
  assert.equal(
    tools.find((t) => t.name === "list_filiais").inputSchema.properties.per_page
      .maximum,
    200,
  );
  for (const tool of tools) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
  }
  for (const contract of contracts) {
    current = contract;
    const result = await client.callTool({
      name: contract[0],
      arguments: contract[1],
    });
    assert.notEqual(
      result.isError,
      true,
      `${contract[0]}: ${JSON.stringify(result)}`,
    );
    if (contract[0] === "panorama_report_csv")
      assert.deepEqual(result.structuredContent, { result: "a;b\n1;2" });
    else
      assert.deepEqual(result.structuredContent, {
        preview: true,
        total_capped: true,
        avisos: ["preserved"],
      });
  }
});

test("MCP returns actionable PRO/quota errors and redacts reflected credentials", async (t) => {
  let status = 403;
  const client = await connect(t, {
    apiKey: "secret-key",
    fetchImpl: async () =>
      Response.json(
        {
          detail: { error: "PRO required secret-key", upgrade_url: "/planos" },
        },
        { status, headers: { "Retry-After": "60" } },
      ),
  });
  for (const code of [403, 429, 503]) {
    status = code;
    const result = await client.callTool({
      name: "compliance_dossier",
      arguments: { cnpj: "18236120000158" },
    });
    assert.equal(result.isError, true);
    assert.ok(!JSON.stringify(result).includes("secret-key"));
    const detail = JSON.parse(result.content[0].text);
    assert.equal(detail.status, code);
    assert.equal(detail.retryAfter, "60");
    assert.equal(detail.payload.detail.upgrade_url, "/planos");
  }
});

test("MCP rejects invalid input and cross-field omissions without fetching", async (t) => {
  const client = await connect(t, {
    fetchImpl: async () => assert.fail("invalid input reached API"),
  });
  for (const [name, args] of [
    ["search_companies", { query: "abc" }],
    ["companies_by_contact", {}],
    ["lookup_cnpj", { cnpj: "12ABC345" }],
  ]) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true);
  }
});

test("MCP array responses are wrapped for structuredContent", async (t) => {
  const payload = [{ codigo: "7107", descricao: "SAO PAULO" }];
  const client = await connect(t, {
    tools: ["municipalities_by_uf"],
    fetchImpl: async () => Response.json(payload),
  });
  const { tools } = await client.listTools();
  assert.equal(tools.length, 1);
  const result = await client.callTool({
    name: "municipalities_by_uf",
    arguments: { uf: "SP" },
  });
  assert.deepEqual(result.structuredContent, { result: payload });
  assert.deepEqual(JSON.parse(result.content[0].text), payload);
});

test("CLI completes a real stdio handshake, lists tools, and reports validation errors", async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/cli.js"],
    env: { CNPJABERTO_API_KEY: "", CNPJABERTO_BASE_URL: "http://127.0.0.1:1" },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const client = new McpClient({ name: "stdio-test", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(transport);
  assert.equal(client.getServerVersion().version, VERSION);
  assert.equal((await client.listTools()).tools.length, 40);
  const result = await client.callTool({
    name: "search_companies",
    arguments: { query: "a" },
  });
  assert.equal(result.isError, true);
  assert.equal(stderr, "");
});
