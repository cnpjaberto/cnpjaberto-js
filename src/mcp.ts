import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Client } from "./client.js";

export interface BuildOptions {
  apiKey?: string;
  baseUrl?: string;
}

export function buildServer(opts: BuildOptions = {}): McpServer {
  const client = new Client({
    apiKey: opts.apiKey ?? process.env.CNPJABERTO_API_KEY,
    baseUrl: opts.baseUrl ?? process.env.CNPJABERTO_BASE_URL,
  });

  const server = new McpServer(
    { name: "cnpjaberto", version: "0.1.0" },
    {
      instructions:
        "Dados públicos de CNPJ (cadastro de empresas brasileiras) via " +
        "cnpjaberto.com.br. Aceita CNPJ em dígitos ou formatado. Defina " +
        "a variável CNPJABERTO_API_KEY com a chave da sua conta.",
    },
  );

  server.tool(
    "lookup_cnpj",
    "Registro completo de uma empresa pelo CNPJ. Aceita 8, 12 ou 14 dígitos, com ou sem pontuação. No topo retorna razao_social, capital_social, natureza_juridica, simples, socios. A lista estabelecimentos[] traz matriz e filiais, com situacao_cadastral, endereço e CNAEs.",
    { cnpj: z.string().describe("CNPJ em dígitos ou formatado") },
    async ({ cnpj }) => ({
      content: [{ type: "text", text: JSON.stringify(await client.lookup(cnpj)) }],
    }),
  );

  server.tool(
    "list_filiais",
    "Lista as filiais de uma matriz. Opcionalmente filtra por UF.",
    {
      cnpj: z.string(),
      page: z.number().int().min(1).default(1),
      per_page: z.number().int().min(1).max(50).default(50),
      uf: z.string().length(2).optional(),
    },
    async ({ cnpj, page, per_page, uf }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await client.filiais(cnpj, { page, perPage: per_page, uf })),
        },
      ],
    }),
  );

  server.tool(
    "search_companies",
    "Busca empresas por razão social, fantasia ou dígitos do CNPJ. A query precisa de no mínimo 3 caracteres; per_page é limitado a 20.",
    {
      query: z.string().min(3),
      page: z.number().int().min(1).default(1),
      per_page: z.number().int().min(1).max(20).default(20),
    },
    async ({ query, page, per_page }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await client.search(query, { page, perPage: per_page })),
        },
      ],
    }),
  );

  server.tool(
    "companies_by_owner",
    "Acha empresas onde uma pessoa aparece como sócia. cpf em dígitos (parcial é aceito) ajuda a desambiguar homônimos.",
    {
      name: z.string().min(3),
      cpf: z.string().optional(),
      exclude: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    },
    async ({ name, cpf, exclude, limit }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(await client.companiesByOwner(name, { cpf, exclude, limit })),
        },
      ],
    }),
  );

  server.tool(
    "companies_at_same_address",
    "Empresas que compartilham um endereço específico. CEP exige 8 dígitos.",
    {
      cep: z.string(),
      logradouro: z.string(),
      numero: z.string(),
      exclude: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ cep, logradouro, numero, exclude, limit }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await client.companiesAtSameAddress(cep, logradouro, numero, { exclude, limit }),
          ),
        },
      ],
    }),
  );

  server.tool(
    "companies_by_contact",
    "Acha empresas que compartilham um contato. Informe email OU (ddd E telefone).",
    {
      email: z.string().email().optional(),
      ddd: z.string().min(2).max(4).optional(),
      telefone: z.string().min(4).max(8).optional(),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ email, ddd, telefone, limit }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            await client.companiesByContact({ email, ddd, telefone, limit }),
          ),
        },
      ],
    }),
  );

  server.tool(
    "cnae_stats",
    "Estatísticas agregadas de um CNAE: total de empresas, top UFs, top municípios.",
    { codigo: z.string() },
    async ({ codigo }) => ({
      content: [{ type: "text", text: JSON.stringify(await client.cnaeStats(codigo)) }],
    }),
  );

  server.tool(
    "panorama_overview",
    "Estatísticas nacionais: total de empresas ativas, top UFs e CNAEs, faixas de capital social, faixas etárias, histórico de 10 anos.",
    {},
    async () => ({
      content: [{ type: "text", text: JSON.stringify(await client.panoramaOverview()) }],
    }),
  );

  server.tool(
    "panorama_year",
    "Snapshot anual: aberturas, fechamentos, série mensal, top CNAEs e UFs, fatia MEI.",
    { year: z.number().int().min(2000).max(2100) },
    async ({ year }) => ({
      content: [{ type: "text", text: JSON.stringify(await client.panoramaYear(year)) }],
    }),
  );

  return server;
}

export async function runStdio(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
