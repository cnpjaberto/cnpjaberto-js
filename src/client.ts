import { AuthError, CnpjAbertoError, NotFoundError, RateLimitError } from "./errors.js";

const DEFAULT_BASE_URL = "https://cnpjaberto.com.br";
const DEFAULT_TIMEOUT_MS = 30_000;

export const VERSION = "0.1.0";

export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class Client {
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.CNPJABERTO_API_KEY;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async get(path: string, params: Record<string, unknown> = {}): Promise<any> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      "User-Agent": `cnpjaberto-js/${VERSION}`,
      "Accept": "application/json",
    };
    if (this.apiKey) headers["X-API-Key"] = this.apiKey;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, { headers, signal: ac.signal });
    } catch (e) {
      throw new CnpjAbertoError(`HTTP transport error: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {}

    if (res.status === 401 || res.status === 403) {
      throw new AuthError(`Authentication failed (${res.status})`, res.status, payload);
    }
    if (res.status === 404) {
      throw new NotFoundError("Resource not found", 404, payload);
    }
    if (res.status === 429) {
      throw new RateLimitError("Rate limit exceeded", 429, payload);
    }
    if (res.status >= 400) {
      throw new CnpjAbertoError(`HTTP ${res.status}`, res.status, payload);
    }
    return payload;
  }

  lookup(cnpj: string): Promise<any> {
    return this.get(`/api/cnpj/${digits(cnpj)}`);
  }

  filiais(
    cnpj: string,
    opts: { page?: number; perPage?: number; uf?: string } = {},
  ): Promise<any> {
    return this.get(`/api/cnpj/${digits(cnpj)}/filiais`, {
      page: opts.page ?? 1,
      per_page: opts.perPage ?? 50,
      uf: opts.uf,
    });
  }

  search(q: string, opts: { page?: number; perPage?: number } = {}): Promise<any> {
    if (q.trim().length < 3) throw new Error("`q` precisa ter pelo menos 3 caracteres");
    return this.get("/api/search", {
      q,
      page: opts.page ?? 1,
      per_page: opts.perPage ?? 20,
    });
  }

  companiesByOwner(
    name: string,
    opts: { cpf?: string; exclude?: string; limit?: number } = {},
  ): Promise<any> {
    return this.get("/api/socio/empresas", {
      nome: name,
      cpf: opts.cpf,
      exclude: opts.exclude,
      limit: opts.limit ?? 20,
    });
  }

  companiesAtSameAddress(
    cep: string,
    logradouro: string,
    numero: string,
    opts: { exclude?: string; limit?: number } = {},
  ): Promise<any> {
    const cepDigits = digits(cep);
    if (cepDigits.length !== 8) throw new Error("`cep` precisa ter exatamente 8 dígitos");
    return this.get("/api/endereco/empresas", {
      cep: cepDigits,
      logradouro,
      numero,
      exclude: opts.exclude,
      limit: opts.limit ?? 20,
    });
  }

  companiesByContact(
    opts: {
      email?: string;
      ddd?: string;
      telefone?: string;
      exclude?: string;
      limit?: number;
    },
  ): Promise<any> {
    if (!opts.email && !(opts.ddd && opts.telefone)) {
      throw new Error("Informe `email` ou ambos `ddd` e `telefone`");
    }
    return this.get("/api/contato/empresas", {
      email: opts.email,
      ddd: opts.ddd,
      telefone: opts.telefone,
      exclude: opts.exclude,
      limit: opts.limit ?? 20,
    });
  }

  cnaeStats(codigo: string): Promise<any> {
    return this.get(`/api/cnae/${codigo}/stats`);
  }

  panoramaOverview(): Promise<any> {
    return this.get("/api/panorama/overview");
  }

  panoramaYear(year: number): Promise<any> {
    return this.get(`/api/panorama/year/${Math.trunc(year)}`);
  }
}

function digits(s: string): string {
  return String(s).replace(/\D+/g, "");
}
