import { z } from "zod";

/** Formatting only: letters in the first twelve CNPJ positions must survive. */
export const normalizeCnpj = (value: string): string =>
  value.toUpperCase().replace(/[.\/\-\s]/g, "");
const cnpj = z
  .string()
  .transform(normalizeCnpj)
  .pipe(
    z
      .string()
      .regex(
        /^(?:[A-Z0-9]{8}|[A-Z0-9]{12}|[A-Z0-9]{12}[0-9]{2})$/,
        "Use uma raiz de 8, prefixo de 12 ou CNPJ de 14 caracteres",
      ),
  );
const fullCnpj = z
  .string()
  .transform(normalizeCnpj)
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]{12}[0-9]{2}$/, "Use o CNPJ completo de 14 caracteres"),
  );
const root = z
  .string()
  .transform(normalizeCnpj)
  .pipe(z.string().regex(/^[A-Z0-9]{8}$/, "Use a raiz CNPJ de 8 caracteres"));
const uf = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z.enum([
      "AC",
      "AL",
      "AP",
      "AM",
      "BA",
      "CE",
      "DF",
      "ES",
      "GO",
      "MA",
      "MT",
      "MS",
      "MG",
      "PA",
      "PB",
      "PR",
      "PE",
      "PI",
      "RJ",
      "RN",
      "RS",
      "RO",
      "RR",
      "SC",
      "SP",
      "SE",
      "TO",
    ]),
  );
const text = (min = 1) => z.string().trim().min(min);
const integer = (max: number, defaultValue: number) =>
  z.number().int().min(1).max(max).default(defaultValue);
const cpf = text(3).optional();
const owner = {
  name: text(3),
  cpf,
  exclude: root.optional(),
  limit: integer(50, 20),
};
const page = { page: integer(50, 1), per_page: integer(50, 20) };
const municipality = z
  .string()
  .regex(
    /^\d{4,7}$/,
    "Use o código retornado por municipalities_by_uf/search_municipalities",
  );
const cep = z
  .string()
  .transform((v) => v.replace(/[\-\s]/g, ""))
  .pipe(z.string().regex(/^\d{8}$/));
const money = z.number().finite().nonnegative().optional();
const date = z.string().date().optional();
const filters = {
  cnae: text().optional(),
  situacao: text().optional(),
  porte: text().optional(),
  capital_min: money,
  capital_max: money,
  com_email: z.boolean().optional(),
  com_telefone: z.boolean().optional(),
};
const year = z
  .number()
  .int()
  .min(2020)
  .refine(
    (v) =>
      v <=
      Number(
        new Intl.DateTimeFormat("en", {
          year: "numeric",
          timeZone: "America/Sao_Paulo",
        }).format(new Date()),
      ),
    "Ano futuro indisponível",
  );
const period = z
  .string()
  .regex(
    /^(?:20[2-9][0-9]|2100)(?:0[1-9]|1[0-2])?$/,
    "Use YYYY ou YYYYMM (2020–2100)",
  );
const report = {
  periodo: period,
  uf: z.union([z.literal("BR"), uf]).default("BR"),
  recorte: z
    .enum(["todos", "mei", "nao_mei", "indeterminado"])
    .default("todos"),
  tema: z
    .enum(["beleza", "alimentacao", "tecnologia", "logistica", "saude"])
    .optional(),
  edicao: z
    .string()
    .regex(/^[a-f0-9]{16}$/)
    .optional(),
};

export type Query = Record<string, unknown>;
interface RequestSpec {
  path: string;
  query?: Query;
  body?: unknown;
  format?: "text";
}
function operation<S extends z.ZodRawShape>(
  description: string,
  shape: S,
  request: (args: z.output<z.ZodObject<S>>) => RequestSpec,
) {
  return { description, schema: z.object(shape).strict(), request };
}
const get = <S extends z.ZodRawShape>(
  description: string,
  path: string,
  shape: S,
) => operation(description, shape, (query) => ({ path, query }));
const byCnpj = (description: string, prefix: string) =>
  operation(description, { cnpj: fullCnpj }, ({ cnpj }) => ({
    path: `${prefix}/${cnpj}`,
  }));

/** API-key compatible routes, audited against backend commit 50b1700 (2026-10-04). */
export const operations = {
  lookup_cnpj: byCnpj(
    "Ficha cadastral, sócios, porte e totais de filiais. estabelecimentos[] contém o estabelecimento solicitado para CNPJ completo via API Key; use list_filiais para filiais. Aceita CNPJ completo numérico ou alfanumérico (14 caracteres).",
    "/api/cnpj",
  ),
  list_filiais: operation(
    "Filiais da mesma raiz; aceita matriz ou filial. Até 200 itens/página e 200 páginas; filtro UF e busca textual q.",
    {
      cnpj: fullCnpj,
      page: integer(200, 1),
      per_page: integer(200, 50),
      uf: uf.optional(),
      q: text().max(120).optional(),
    },
    ({ cnpj, ...query }) => ({ path: `/api/cnpj/${cnpj}/filiais`, query }),
  ),
  search_companies: operation(
    "Busca por razão social, fantasia ou CNPJ; mínimo 4 caracteres, até 20 itens/página e 50 páginas.",
    { query: text(4), page: integer(50, 1), per_page: integer(20, 20) },
    ({ query: q, ...rest }) => ({ path: "/api/search", query: { q, ...rest } }),
  ),
  companies_by_owner: operation(
    "Empresas de um sócio. CPF/CNPJ parcial ajuda a desambiguar homônimos; não identifica uma pessoa com certeza.",
    owner,
    ({ name: nome, ...rest }) => ({
      path: "/api/socio/empresas",
      query: { nome, ...rest },
    }),
  ),
  owner_companies_summary: operation(
    "Contagem leve de empresas por sócio, preservando documento_filtro_aplicado.",
    owner,
    ({ name: nome, ...rest }) => ({
      path: "/api/socio/empresas-resumo",
      query: { nome, ...rest },
    }),
  ),
  owner_summaries_batch: operation(
    "Consulta em lote de contagens por sócio (até 10.000). A ordem de items da resposta corresponde à entrada. POST somente de consulta.",
    {
      items: z.array(z.object({ nome: text(3), cpf })).max(10_000),
      exclude: root.optional(),
      limit: integer(50, 20),
    },
    (body) => ({ path: "/api/socio/empresas-resumo/batch", body }),
  ),
  companies_at_same_address: get(
    "PRO na API: empresas no mesmo CEP, logradouro e número. exclude é a raiz CNPJ (8 caracteres).",
    "/api/endereco/empresas",
    {
      cep,
      logradouro: text(),
      numero: text(),
      exclude: root.optional(),
      limit: integer(100, 20),
    },
  ),
  companies_by_contact: get(
    "PRO na API: empresas com e-mail exato OU ddd + telefone. Telefone RF legado de 4–8 dígitos; para celular com 9 dígitos use advanced_search.",
    "/api/contato/empresas",
    {
      email: z.string().email().optional(),
      ddd: z
        .string()
        .regex(/^\d{2,4}$/)
        .optional(),
      telefone: z
        .string()
        .regex(/^\d{4,8}$/)
        .optional(),
      exclude: root.optional(),
      limit: integer(100, 20),
    },
  ),
  participations: operation(
    "PRO na API: empresas que têm o CNPJ consultado como sócio PJ. Respeite total_capped.",
    { cnpj, limit: integer(100, 20) },
    ({ cnpj, ...query }) => ({ path: `/api/participacoes/${cnpj}`, query }),
  ),
  control_tree: byCnpj(
    "PRO: árvore de controle societário, expandindo sócios PJ até pessoas físicas.",
    "/api/controle",
  ),
  common_owners: get(
    "PRO: cruza QSA de 2–50 raízes distintas. intersecao exige presença em todas; sobreposicao usa min_empresas. Preserve avisos e lista_truncada.",
    "/api/socios-comum",
    {
      cnpjs: z.array(cnpj).min(2).max(50),
      modo: z.enum(["intersecao", "sobreposicao"]).default("intersecao"),
      min_empresas: z.number().int().min(2).max(50).default(2),
    },
  ),
  advanced_search: get(
    "Busca avançada: exige CNAE, código de município, nome (4+), CEP ou contato exato; apenas UF não basta (até 5 UFs). Filtro MEI exige cidade. Contato e endereço exato são PRO: com_email, com_telefone, email, telefone, cep, numero. Telefone aceita máscara, DDI 55 e nono dígito. Preserve total_capped.",
    "/api/busca-avancada",
    {
      ...filters,
      ...page,
      uf: text().optional(),
      mei: z.boolean().optional(),
      municipio: text().optional(),
      municipio_codigo: municipality.optional(),
      municipio_uf: uf.optional(),
      nome_empresa: text(4).max(200).optional(),
      email: text().max(200).optional(),
      telefone: text().max(20).optional(),
      cep: cep.optional(),
      numero: text().max(20).optional(),
    },
  ),
  competitors: byCnpj(
    "Concorrentes da empresa; limite fixo de 8, sem parâmetro limit.",
    "/api/concorrentes",
  ),
  person_profile: get(
    "Raio-X societário por nome e CPF/CNPJ parcial. Conta gratuita recebe prévia; PRO desbloqueia detalhes. Respeite campos de prévia e máscaras retornadas.",
    "/api/pessoa/raio-x",
    { nome: text(3), cpf },
  ),
  search_owners: get(
    "Busca sócios por nome ou CPF/CNPJ; use sobrenome ou filtros para evitar busca ampla. Até 25 páginas.",
    "/api/socios/busca",
    {
      nome: text(3).optional(),
      cpf,
      faixa_etaria: text().optional(),
      municipio: text(2).optional(),
      municipio_codigo: municipality.optional(),
      page: integer(25, 1),
      per_page: integer(50, 20),
    },
  ),
  autocomplete_owners: get(
    "Sugestões de sócios para desambiguação; documentos PF públicos podem estar mascarados.",
    "/api/socios/autocomplete",
    { q: text(3), limit: integer(15, 10) },
  ),
  leads: get(
    "Prospecção por UF e código de município obrigatórios. PRO libera contatos; plano gratuito recebe contact_gated e contatos mascarados (não são contatos reais). Preserve total_capped.",
    "/api/leads",
    {
      ...filters,
      ...page,
      uf,
      municipio_codigo: municipality,
      idade_min: z.number().int().nonnegative().optional(),
      idade_max: z.number().int().nonnegative().optional(),
      data_abertura_min: date,
      data_abertura_max: date,
    },
  ),
  companies_by_city: get(
    "PRO: empresas ativas do município; código obtido nas ferramentas de municípios. Filtra nome, logradouro e bairro.",
    "/api/empresas-cidade",
    {
      uf,
      municipio: municipality,
      page: integer(200, 1),
      per_page: integer(100, 50),
      q: text().optional(),
      logradouro: text(2).optional(),
      bairro: text(2).optional(),
    },
  ),
  corporate_group: byCnpj(
    "PRO na API: mapa do grupo empresarial, com pessoas, empresas e vínculos societários.",
    "/api/intelligence/grupo",
  ),
  red_flags: byCnpj(
    "Indicadores cadastrais de atenção e score, não prova de irregularidade. Preserve os motivos retornados.",
    "/api/intelligence/red-flags",
  ),
  ownership_network: get(
    "Rede societária por nome ou CPF; informe cpf parcial para reduzir homônimos. Preserve avisos, limites e flags de prévia.",
    "/api/intelligence/rede",
    { q: text(2), cpf },
  ),
  compliance_summary: byCnpj(
    "Resumo de sanções diretas e dívida ativa da própria empresa. Ausência de registros não é certificação de regularidade.",
    "/api/compliance/resumo",
  ),
  compliance_dossier: byCnpj(
    "PRO: dossiê de compliance com sanções, PEP de sócios, dívida ativa e red flags. Preserve fontes, datas e ressalvas de homônimos.",
    "/api/compliance/dossie",
  ),
  active_debt: byCnpj(
    "Dívida Ativa da União (PGFN). encontrado=false é um resultado válido, não um erro 404.",
    "/api/compliance/divida-ativa",
  ),
  cnae_stats: operation(
    "Estatísticas por CNAE: empresas, situação, UFs e empresas representativas.",
    {
      codigo: z
        .string()
        .transform((v) => v.replace(/[.\/-]/g, ""))
        .pipe(z.string().regex(/^\d{7}$/)),
    },
    ({ codigo }) => ({ path: `/api/cnae/${codigo}/stats` }),
  ),
  list_cnaes: get("Todos os códigos CNAE da base.", "/api/cnaes", {}),
  cnae_catalog: get(
    "Códigos e descrições CNAE; filtre por seção A–U.",
    "/api/cnaes/catalog",
    {
      secao: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-U]$/)
        .optional(),
    },
  ),
  cnae_hub_summary: get(
    "Resumo das seções CNAE e suas contagens.",
    "/api/cnaes/hub-summary",
    {},
  ),
  search_cnaes: get("Busca código ou descrição CNAE.", "/api/cnaes/search", {
    q: text(),
    limit: integer(30, 10),
  }),
  search_municipalities: get(
    "Busca municípios; use codigo retornado nos filtros, sem converter para outro sistema de códigos. UF desambigua nomes.",
    "/api/municipios/search",
    { q: text(2), uf: uf.optional(), limit: integer(30, 15) },
  ),
  municipalities_by_uf: get(
    "Municípios de uma UF com codigo e descricao; reutilize o código exatamente como retornado.",
    "/api/municipios-por-uf",
    { uf },
  ),
  services_catalog: get(
    "Catálogo de serviços e slugs para search_services.",
    "/api/servicos/catalog",
    {},
  ),
  search_services: get(
    "Empresas prestadoras de um serviço por UF e município. Use slug do catálogo; sem_mei exclui MEI.",
    "/api/servicos",
    {
      servico: text(2),
      uf,
      municipio_codigo: municipality,
      ...page,
      sem_mei: z.boolean().default(false),
    },
  ),
  panorama_overview: get(
    "Panorama nacional; sem_mei exclui optantes MEI. Preserve fonte e data da base.",
    "/api/panorama/overview",
    { sem_mei: z.boolean().default(false) },
  ),
  panorama_year: operation(
    "Panorama anual de 2020 ao ano atual; sem_mei exclui MEI.",
    { year, sem_mei: z.boolean().default(false) },
    ({ year, ...query }) => ({ path: `/api/panorama/year/${year}`, query }),
  ),
  panorama_alphanumeric: operation(
    "Painel de CNPJs alfanuméricos; totais da base e série mensal do ano solicitado.",
    { year },
    ({ year }) => ({ path: `/api/panorama/alfanumericos/${year}` }),
  ),
  panorama_catalog: get(
    "Edições e períodos publicados do Panorama. Consulte antes de solicitar relatório; edicao fixa uma edição imutável.",
    "/api/panorama/catalog",
    { edicao: report.edicao },
  ),
  panorama_report: operation(
    "Relatório publicado YYYY ou YYYYMM por UF, recorte MEI e tema. Preserve edição, fonte, metodologia e parcial.",
    report,
    ({ periodo, ...query }) => ({
      path: `/api/panorama/report/${periodo}`,
      query,
    }),
  ),
  panorama_report_csv: operation(
    "CSV de relatório publicado; retorna texto separado por ponto e vírgula, com atribuição e metodologia.",
    {
      ...report,
      tabela: z
        .enum([
          "cnaes",
          "municipios",
          "ufs",
          "idades",
          "historico",
          "segmentos",
          "divisoes",
        ])
        .default("cnaes"),
    },
    ({ periodo, ...query }) => ({
      path: `/api/panorama/report/${periodo}/csv`,
      query,
      format: "text",
    }),
  ),
  panorama_revisions: operation(
    "Histórico de revisões publicadas de um período YYYY ou YYYYMM.",
    { periodo: period },
    ({ periodo }) => ({ path: `/api/panorama/report/${periodo}/revisions` }),
  ),
} as const;

export type OperationName = keyof typeof operations;
export type OperationInput<K extends OperationName> = z.input<
  (typeof operations)[K]["schema"]
>;

/** Cross-field checks shared by direct SDK calls and MCP calls. */
export function validateCombination(name: OperationName, args: Query): void {
  if (
    name === "companies_by_contact" &&
    !args.email &&
    !(args.ddd && args.telefone)
  )
    throw new Error("Informe email OU (ddd + telefone)");
  if (name === "search_owners" && !args.nome && !args.cpf)
    throw new Error("Informe nome ou CPF/CNPJ");
  if (
    name === "common_owners" &&
    new Set((args.cnpjs as string[]).map((v) => v.slice(0, 8))).size < 2
  )
    throw new Error("Informe pelo menos duas raízes CNPJ distintas");
  for (const prefix of ["capital", "idade", "data_abertura"]) {
    const min = args[`${prefix}_min`],
      max = args[`${prefix}_max`];
    if (
      ((typeof min === "number" && typeof max === "number") ||
        (typeof min === "string" && typeof max === "string")) &&
      min > max
    )
      throw new Error(`${prefix}_min não pode exceder ${prefix}_max`);
  }
  if (name === "advanced_search") {
    if (typeof args.uf === "string") {
      const states = args.uf.split(",").map((v) => uf.parse(v));
      if (states.length > 5) throw new Error("Use até 5 UFs");
      args.uf = states.join(",");
    }
    if (
      ![
        "cnae",
        "municipio_codigo",
        "nome_empresa",
        "email",
        "telefone",
        "cep",
      ].some((key) => Boolean(args[key]))
    )
      throw new Error(
        "Informe CNAE, código de município, nome da empresa, CEP ou contato exato",
      );
    if (
      args.mei !== undefined &&
      !args.municipio_codigo &&
      !(args.municipio && args.uf)
    )
      throw new Error("Para filtrar por MEI, selecione também uma cidade");
    if (args.numero && !args.cep) throw new Error("numero requer cep");
  }
}
