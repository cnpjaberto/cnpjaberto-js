import { z } from "zod";
import {
  AuthError,
  CnpjAbertoError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  TransportError,
  ValidationError,
} from "./errors.js";
import { operations, validateCombination } from "./operations.js";
import type { OperationInput, OperationName, Query } from "./operations.js";
import type {
  AdvancedSearchOptions,
  CityOptions,
  LeadsOptions,
  OperationResponse,
  OwnerSearchOptions,
  PanoramaCsvOptions,
  PanoramaReportOptions,
  ServiceSearchOptions,
} from "./types.js";

export const VERSION = "0.2.0";
export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}
export interface RequestOptions {
  signal?: AbortSignal;
}
export type OwnerOptions = Omit<OperationInput<"companies_by_owner">, "name">;
export interface PaginationOptions {
  page?: number;
  perPage?: number;
}
export interface BranchOptions extends PaginationOptions {
  uf?: string;
  q?: string;
}

export class Client {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.CNPJABERTO_API_KEY;
    const url = new URL(
      opts.baseUrl ??
        process.env.CNPJABERTO_BASE_URL ??
        "https://cnpjaberto.com.br",
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new ValidationError(
        "baseUrl deve ser uma URL HTTP(S) sem credenciais, query ou fragmento",
      );
    this.baseUrl = url.href.replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    if (
      !Number.isFinite(this.timeoutMs) ||
      this.timeoutMs <= 0 ||
      this.timeoutMs > 2_147_483_647
    )
      throw new ValidationError(
        "timeoutMs deve ser positivo e no máximo 2147483647",
      );
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** Typed, validated access to every MCP operation; no arbitrary URLs or auth overrides. */
  async execute<K extends OperationName>(
    name: K,
    input: OperationInput<K>,
    options: RequestOptions = {},
  ): Promise<OperationResponse<K>> {
    const operation = operations[name];
    if (!operation) throw new ValidationError(`Operação desconhecida: ${name}`);
    let args: Query;
    try {
      args = operation.schema.parse(input);
      validateCombination(name, args);
    } catch (error) {
      const message =
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : (error as Error).message;
      throw new ValidationError(message);
    }
    // The name selects its schema and request builder together; their union loses this correlation in TS.
    const spec = (
      operation.request as (args: Query) => {
        path: string;
        query?: Query;
        body?: unknown;
        format?: "text";
      }
    )(args);
    const url = new URL(this.baseUrl + spec.path);
    for (const [key, value] of Object.entries(spec.query ?? {})) {
      if (value === undefined || value === null) continue;
      for (const item of Array.isArray(value) ? value : [value])
        url.searchParams.append(key, String(item));
    }
    const headers: Record<string, string> = {
      "User-Agent": `cnpjaberto-js/${VERSION}`,
      Accept: spec.format === "text" ? "text/csv" : "application/json",
    };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;
    if (spec.body !== undefined) headers["Content-Type"] = "application/json";
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    try {
      // Never forward API keys to a redirect target, including a different origin.
      const response = await this.fetchImpl(url, {
        method: spec.body === undefined ? "GET" : "POST",
        headers,
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        signal: controller.signal,
        redirect: "error",
      });
      const text = await response.text();
      let payload: unknown;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }
      if (!response.ok) {
        const ErrorType =
          response.status === 401
            ? AuthError
            : response.status === 403
              ? ForbiddenError
              : response.status === 404
                ? NotFoundError
                : response.status === 429
                  ? RateLimitError
                  : [400, 422].includes(response.status)
                    ? ValidationError
                    : CnpjAbertoError;
        const detail =
          payload && typeof payload === "object"
            ? ((payload as Record<string, unknown>).detail ?? payload)
            : payload;
        const message =
          typeof detail === "string" ? detail : JSON.stringify(detail);
        throw new ErrorType(
          `HTTP ${response.status}: ${message}`,
          response.status,
          payload,
          response.headers.get("Retry-After") ?? undefined,
        );
      }
      if (spec.format === "text") return text as OperationResponse<K>;
      // An HTML challenge/maintenance page with HTTP 200 is not a successful API response.
      if (payload === null || typeof payload !== "object")
        throw new CnpjAbertoError(
          "Resposta JSON inválida da API",
          response.status,
          payload,
        );
      return payload as OperationResponse<K>;
    } catch (error) {
      if (error instanceof CnpjAbertoError) throw error;
      if (timedOut)
        throw new TimeoutError(`Tempo limite de ${this.timeoutMs} ms excedido`);
      if (options.signal?.aborted)
        throw new TransportError("Requisição cancelada");
      // Fetch errors can include URLs/headers from custom transports; do not echo secrets.
      throw new TransportError("Falha de transporte HTTP");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  lookup(cnpj: string) {
    return this.execute("lookup_cnpj", { cnpj });
  }
  filiais(cnpj: string, opts: BranchOptions = {}) {
    const { perPage, ...rest } = opts;
    return this.execute("list_filiais", { cnpj, ...rest, per_page: perPage });
  }
  search(q: string, opts: PaginationOptions = {}) {
    return this.execute("search_companies", {
      query: q,
      page: opts.page,
      per_page: opts.perPage,
    });
  }
  companiesByOwner(name: string, opts: OwnerOptions = {}) {
    return this.execute("companies_by_owner", { name, ...opts });
  }
  ownerCompaniesSummary(name: string, opts: OwnerOptions = {}) {
    return this.execute("owner_companies_summary", { name, ...opts });
  }
  ownerSummariesBatch(
    items: OperationInput<"owner_summaries_batch">["items"],
    opts: Omit<OperationInput<"owner_summaries_batch">, "items"> = {},
  ) {
    return this.execute("owner_summaries_batch", { items, ...opts });
  }
  companiesAtSameAddress(
    cep: string,
    logradouro: string,
    numero: string,
    opts: { exclude?: string; limit?: number } = {},
  ) {
    return this.execute("companies_at_same_address", {
      cep,
      logradouro,
      numero,
      ...opts,
    });
  }
  companiesByContact(opts: OperationInput<"companies_by_contact">) {
    return this.execute("companies_by_contact", opts);
  }
  participations(cnpj: string, opts: { limit?: number } = {}) {
    return this.execute("participations", { cnpj, ...opts });
  }
  controlTree(cnpj: string) {
    return this.execute("control_tree", { cnpj });
  }
  commonOwners(
    cnpjs: string[],
    opts: Omit<OperationInput<"common_owners">, "cnpjs"> = {},
  ) {
    return this.execute("common_owners", { cnpjs, ...opts });
  }
  advancedSearch(opts: AdvancedSearchOptions) {
    return this.execute("advanced_search", opts);
  }
  competitors(cnpj: string) {
    return this.execute("competitors", { cnpj });
  }
  personProfile(nome: string, opts: { cpf?: string } = {}) {
    return this.execute("person_profile", { nome, ...opts });
  }
  searchOwners(opts: OwnerSearchOptions) {
    return this.execute("search_owners", opts);
  }
  autocompleteOwners(q: string, opts: { limit?: number } = {}) {
    return this.execute("autocomplete_owners", { q, ...opts });
  }
  leads(opts: LeadsOptions) {
    return this.execute("leads", opts);
  }
  companiesByCity(opts: CityOptions) {
    return this.execute("companies_by_city", opts);
  }
  corporateGroup(cnpj: string) {
    return this.execute("corporate_group", { cnpj });
  }
  redFlags(cnpj: string) {
    return this.execute("red_flags", { cnpj });
  }
  ownershipNetwork(q: string, opts: { cpf?: string } = {}) {
    return this.execute("ownership_network", { q, ...opts });
  }
  complianceSummary(cnpj: string) {
    return this.execute("compliance_summary", { cnpj });
  }
  complianceDossier(cnpj: string) {
    return this.execute("compliance_dossier", { cnpj });
  }
  activeDebt(cnpj: string) {
    return this.execute("active_debt", { cnpj });
  }
  cnaeStats(codigo: string) {
    return this.execute("cnae_stats", { codigo });
  }
  listCnaes() {
    return this.execute("list_cnaes", {});
  }
  cnaeCatalog(secao?: string) {
    return this.execute("cnae_catalog", { secao });
  }
  cnaeHubSummary() {
    return this.execute("cnae_hub_summary", {});
  }
  searchCnaes(q: string, opts: { limit?: number } = {}) {
    return this.execute("search_cnaes", { q, ...opts });
  }
  searchMunicipalities(q: string, opts: { uf?: string; limit?: number } = {}) {
    return this.execute("search_municipalities", { q, ...opts });
  }
  municipalitiesByUf(uf: string) {
    return this.execute("municipalities_by_uf", { uf });
  }
  servicesCatalog() {
    return this.execute("services_catalog", {});
  }
  searchServices(opts: ServiceSearchOptions) {
    return this.execute("search_services", opts);
  }
  panoramaOverview(opts: { sem_mei?: boolean } = {}) {
    return this.execute("panorama_overview", opts);
  }
  panoramaYear(year: number, opts: { sem_mei?: boolean } = {}) {
    return this.execute("panorama_year", { year, ...opts });
  }
  panoramaAlphanumeric(year: number) {
    return this.execute("panorama_alphanumeric", { year });
  }
  panoramaCatalog(edicao?: string) {
    return this.execute("panorama_catalog", { edicao });
  }
  panoramaReport(periodo: string, opts: PanoramaReportOptions = {}) {
    return this.execute("panorama_report", { periodo, ...opts });
  }
  panoramaReportCsv(periodo: string, opts: PanoramaCsvOptions = {}) {
    return this.execute("panorama_report_csv", { periodo, ...opts });
  }
  panoramaRevisions(periodo: string) {
    return this.execute("panorama_revisions", { periodo });
  }
}
