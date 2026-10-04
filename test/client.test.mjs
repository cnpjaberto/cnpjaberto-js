import test from "node:test";
import assert from "node:assert/strict";
import {
  Client,
  VERSION,
  AuthError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  TimeoutError,
  TransportError,
  CnpjAbertoError,
} from "../dist/index.js";
import { contracts, cnpj } from "./contracts.mjs";

for (const [name, , method, args, path, query, body] of contracts) {
  test(`SDK contract: ${name}`, async () => {
    let called = false;
    const client = new Client({
      apiKey: "test-key",
      baseUrl: "https://example.test/",
      fetchImpl: async (url, init) => {
        called = true;
        assert.equal(url.pathname, path);
        const actual = {};
        for (const key of url.searchParams.keys())
          actual[key] =
            url.searchParams.getAll(key).length > 1
              ? url.searchParams.getAll(key)
              : url.searchParams.get(key);
        assert.deepEqual(actual, query);
        assert.equal(init.method, body ? "POST" : "GET");
        assert.equal(init.headers["X-API-Key"], "test-key");
        assert.equal(init.headers["User-Agent"], `cnpjaberto-js/${VERSION}`);
        assert.equal(init.headers.Authorization, undefined);
        assert.equal(init.redirect, "error");
        assert.equal(init.body, body ? JSON.stringify(body) : undefined);
        if (body)
          assert.equal(init.headers["Content-Type"], "application/json");
        return name === "panorama_report_csv"
          ? new Response("coluna;valor\nfonte;RF")
          : Response.json({ preserved: true });
      },
    });
    const result = await client[method](...args);
    assert.equal(called, true);
    assert.deepEqual(
      result,
      name === "panorama_report_csv"
        ? "coluna;valor\nfonte;RF"
        : { preserved: true },
    );
  });
}

test("invalid inputs fail before any request", async () => {
  const client = new Client({
    fetchImpl: async () => {
      assert.fail("network must not be called");
    },
  });
  const cases = [
    ["lookup_cnpj", { cnpj: "12ABC345" }],
    ["lookup_cnpj", { cnpj: "12ABC34501DEAA" }],
    ["lookup_cnpj", { cnpj: "../%2fhello" }],
    ["search_companies", { query: "abc" }],
    ["search_companies", { query: "    " }],
    ["search_companies", { query: "padaria", page: 51 }],
    ["list_filiais", { cnpj, per_page: 201 }],
    ["list_filiais", { cnpj, page: 0 }],
    ["list_filiais", { cnpj, uf: "ZZ" }],
    ["list_filiais", { cnpj, q: "x".repeat(121) }],
    ["companies_by_contact", {}],
    ["companies_by_contact", { ddd: "11" }],
    ["companies_by_contact", { ddd: "11", telefone: "999998888" }],
    [
      "companies_at_same_address",
      { cep: "abc01310100", logradouro: "X", numero: "1" },
    ],
    ["companies_by_owner", { name: "Maria", cpf: "12" }],
    ["common_owners", { cnpjs: [cnpj, "12ABC345000199"] }],
    ["common_owners", { cnpjs: [cnpj] }],
    ["search_owners", {}],
    ["advanced_search", {}],
    ["advanced_search", { uf: "SP" }],
    ["advanced_search", { cnae: "6201501", mei: false }],
    ["advanced_search", { uf: "SP,RJ,MG,SC,PR,RS" }],
    ["advanced_search", { uf: "SP", capital_min: 20, capital_max: 10 }],
    ["advanced_search", { uf: "SP", numero: "12" }],
    ["advanced_search", { uf: "SP", arbitrary: true }],
    ["leads", { uf: "SP" }],
    [
      "leads",
      { uf: "SP", municipio_codigo: "7107", data_abertura_min: "2026-02-30" },
    ],
    [
      "leads",
      {
        uf: "SP",
        municipio_codigo: "7107",
        data_abertura_min: "2026-09-01",
        data_abertura_max: "2026-01-01",
      },
    ],
    ["panorama_year", { year: 2019 }],
    ["panorama_year", { year: 2100 }],
    ["panorama_year", { year: 2024.5 }],
    ["panorama_report", { periodo: "202613" }],
    ["panorama_report", { periodo: "2026-09" }],
    ["panorama_catalog", { edicao: "../bad" }],
    ["cnae_catalog", { secao: "Z" }],
    [
      "owner_summaries_batch",
      { items: Array.from({ length: 10001 }, () => ({ nome: "Maria" })) },
    ],
  ];
  for (const [name, args] of cases)
    await assert.rejects(client.execute(name, args), ValidationError, name);
});

for (const [status, ErrorType] of [
  [400, ValidationError],
  [401, AuthError],
  [403, ForbiddenError],
  [404, NotFoundError],
  [422, ValidationError],
  [429, RateLimitError],
  [503, CnpjAbertoError],
]) {
  test(`HTTP ${status} preserves details and retry information`, async () => {
    const payload = { detail: { error: "restrição", upgrade_url: "/planos" } };
    const client = new Client({
      fetchImpl: async () =>
        Response.json(payload, { status, headers: { "Retry-After": "3" } }),
    });
    await assert.rejects(client.lookup(cnpj), (error) => {
      assert.ok(error instanceof ErrorType);
      if (status === 403) assert.ok(error instanceof AuthError);
      assert.equal(error.status, status);
      assert.equal(error.retryAfter, "3");
      assert.deepEqual(error.payload, payload);
      assert.match(error.message, /restrição/);
      return true;
    });
  });
}

test("non-JSON failures and HTTP 200 HTML are not silently accepted", async () => {
  for (const status of [200, 502]) {
    const client = new Client({
      fetchImpl: async () =>
        new Response("<html>unavailable</html>", { status }),
    });
    await assert.rejects(
      client.lookup(cnpj),
      (error) => error instanceof CnpjAbertoError && error.status === status,
    );
  }
});

test("timeout covers headers AND a stalled response body", async () => {
  for (const stallBody of [false, true]) {
    const client = new Client({
      timeoutMs: 15,
      fetchImpl: async (_url, { signal }) => {
        const wait = () =>
          new Promise((_, reject) =>
            signal.addEventListener(
              "abort",
              () => reject(new Error("aborted")),
              { once: true },
            ),
          );
        if (!stallBody) return wait();
        return { ok: true, status: 200, text: wait };
      },
    });
    await assert.rejects(client.lookup(cnpj), TimeoutError);
  }
});

test("cancellation propagates and transport errors do not leak secrets", async () => {
  const controller = new AbortController();
  const client = new Client({
    fetchImpl: async (_url, { signal }) => {
      assert.equal(signal.aborted, true);
      throw new Error("secret-key");
    },
  });
  controller.abort();
  await assert.rejects(
    client.execute("lookup_cnpj", { cnpj }, { signal: controller.signal }),
    (error) =>
      error instanceof TransportError && !error.message.includes("secret-key"),
  );
});

test("response payloads preserve gating, missing debt and truncation metadata", async () => {
  const payload = {
    encontrado: false,
    total_capped: true,
    preview: true,
    contact_gated: true,
    avisos: ["homônimos"],
    results: [{ email: "pro@upgrade.com" }],
  };
  const client = new Client({ fetchImpl: async () => Response.json(payload) });
  assert.deepEqual(await client.activeDebt(cnpj), payload);
});

test("configuration validates timeout and URL and honors environment defaults", () => {
  for (const timeoutMs of [0, -1, NaN, Infinity, 2147483648])
    assert.throws(() => new Client({ timeoutMs }), ValidationError);
  for (const baseUrl of [
    "file:///tmp",
    "https://user:pass@example.test",
    "https://example.test/?x=1",
  ])
    assert.throws(() => new Client({ baseUrl }), ValidationError);
  const beforeKey = process.env.CNPJABERTO_API_KEY,
    beforeUrl = process.env.CNPJABERTO_BASE_URL;
  try {
    process.env.CNPJABERTO_API_KEY = "env-key";
    process.env.CNPJABERTO_BASE_URL = "https://example.test/";
    const client = new Client();
    assert.equal(client.apiKey, "env-key");
    assert.equal(client.baseUrl, "https://example.test");
    assert.equal(
      new Client({ apiKey: "", baseUrl: "https://override.test" }).apiKey,
      "",
    );
  } finally {
    if (beforeKey === undefined) delete process.env.CNPJABERTO_API_KEY;
    else process.env.CNPJABERTO_API_KEY = beforeKey;
    if (beforeUrl === undefined) delete process.env.CNPJABERTO_BASE_URL;
    else process.env.CNPJABERTO_BASE_URL = beforeUrl;
  }
});
