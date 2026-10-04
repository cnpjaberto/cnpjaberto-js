import type { OperationInput, OperationName } from "./operations.js";

/** Extensible responses from endpoints without a backend response_model. */
export type ApiObject = Record<string, unknown>;
export interface CompanySummary {
  cnpj: string;
  razao_social: string | null;
  situacao_cadastral: string | null;
}
export interface Owner {
  nome_socio: string | null;
  cpf_cnpj_socio: string | null;
  qualificacao: string | null;
  data_entrada: string | null;
  representante_legal: string | null;
  nome_representante: string | null;
  faixa_etaria: string | null;
  tipo_socio: string | null;
  cnpj_socio_ficha: string | null;
}
export interface Establishment {
  cnpj: string;
  identificador_matriz_filial: string | null;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
  motivo_situacao: string | null;
  data_situacao_cadastral: string | null;
  data_inicio_atividade: string | null;
  cnae_fiscal_principal: string | null;
  cnae_descricao: string | null;
  cnaes: { codigo: string; descricao: string | null; tipo: string }[];
  tipo_logradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string | null;
  municipio: string | null;
  telefone: string | null;
  telefone2: string | null;
  email: string | null;
}
export interface Company {
  cnpj_basico: string;
  razao_social: string | null;
  natureza_juridica: string | null;
  natureza_juridica_descricao: string | null;
  qualificacao_responsavel: string | null;
  capital_social: string | null;
  porte: string | null;
  porte_descricao: string | null;
  ente_federativo: string | null;
  simples: {
    opcao_simples: string | null;
    data_opcao_simples: string | null;
    data_exclusao_simples: string | null;
    opcao_mei: string | null;
    data_opcao_mei: string | null;
    data_exclusao_mei: string | null;
  } | null;
  estabelecimentos: Establishment[];
  socios: Owner[];
  total_estabelecimentos: number;
  total_filiais: number;
  filiais_truncated: boolean;
  filiais_por_uf: { uf: string; total: number; ativas: number }[];
}
export interface BranchPage {
  total: number;
  page: number;
  per_page: number;
  filiais: Establishment[];
}
export interface SearchResult {
  total: number;
  page: number;
  per_page: number;
  results: CompanySummary[];
  socios: {
    nome_socio: string;
    qualificacao: string | null;
    tipo_socio: string | null;
    empresa_cnpj: string | null;
    empresa_razao_social: string | null;
  }[];
  total_socios: number;
}
export interface OwnerSummary {
  nome_socio: string;
  total: number;
  documento_filtro_aplicado: boolean;
}
export interface OwnerCompanies {
  nome_socio: string;
  documento_filtro_aplicado: boolean;
  empresas: (CompanySummary & {
    nome_fantasia: string | null;
    qualificacao: string | null;
    data_entrada: string | null;
  })[];
}
export interface ReferenceItem {
  codigo: string;
  descricao: string | null;
}
export interface NetworkNode {
  id: string;
  tipo: string;
  label: string;
  cnpj: string | null;
  situacao_cadastral: string | null;
  uf: string | null;
}
export interface Network {
  nodes: NetworkNode[];
  edges: { source: string; target: string; label: string }[];
}
export interface OwnershipNetwork extends Network {
  query: string;
  documento_filtro_aplicado: boolean;
  avisos: Record<string, string>[];
  preview: boolean;
  preview_max_nodes: number | null;
  total_pessoas: number | null;
  total_empresas: number | null;
  total_conexoes: number | null;
}
export interface CorporateGroup extends Network {
  cnpj_basico: string;
  razao_social: string | null;
  nodes: (NetworkNode & {
    capital_social: string | null;
    is_target: boolean;
  })[];
}
export interface RedFlags {
  cnpj_basico: string;
  score: number;
  total_empresas_rede: number;
  total_socios: number;
  flags: {
    tipo: string;
    severidade: string;
    titulo: string;
    descricao: string;
  }[];
}
export interface PagedCompanies extends ApiObject {
  total: number;
  page: number;
  per_page: number;
  results: ApiObject[];
  total_capped?: boolean;
}
interface KnownResponses {
  lookup_cnpj: Company;
  list_filiais: BranchPage;
  search_companies: SearchResult;
  companies_by_owner: OwnerCompanies;
  owner_companies_summary: OwnerSummary;
  owner_summaries_batch: { items: OwnerSummary[] };
  companies_at_same_address: {
    total: number;
    endereco: string;
    empresas: (CompanySummary & {
      nome_fantasia: string | null;
      cnae_descricao: string | null;
    })[];
  };
  companies_by_contact: {
    total: number;
    tipo: string;
    contato: string;
    empresas: (CompanySummary & {
      nome_fantasia: string | null;
      cnae_descricao: string | null;
    })[];
  };
  participations: {
    total: number;
    total_capped: boolean;
    empresas: (CompanySummary & { qualificacao: string | null })[];
  };
  advanced_search: PagedCompanies;
  leads: PagedCompanies;
  corporate_group: CorporateGroup;
  ownership_network: OwnershipNetwork;
  red_flags: RedFlags;
  search_cnaes: ReferenceItem[];
  search_municipalities: ReferenceItem[];
  municipalities_by_uf: ReferenceItem[];
  list_cnaes: { codigos: string[] };
  cnae_catalog: { items: ReferenceItem[]; secao?: string; nome?: string };
  panorama_report_csv: string;
  panorama_revisions: ApiObject[];
}
export type OperationResponse<K extends OperationName> =
  K extends keyof KnownResponses ? KnownResponses[K] : ApiObject;
export type AdvancedSearchOptions = OperationInput<"advanced_search">;
export type LeadsOptions = OperationInput<"leads">;
export type OwnerSearchOptions = OperationInput<"search_owners">;
export type CityOptions = OperationInput<"companies_by_city">;
export type ServiceSearchOptions = OperationInput<"search_services">;
export type PanoramaReportOptions = Omit<
  OperationInput<"panorama_report">,
  "periodo"
>;
export type PanoramaCsvOptions = Omit<
  OperationInput<"panorama_report_csv">,
  "periodo"
>;
