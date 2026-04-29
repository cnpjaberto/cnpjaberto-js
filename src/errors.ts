export class CnpjAbertoError extends Error {
  status?: number;
  payload?: unknown;
  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = "CnpjAbertoError";
    this.status = status;
    this.payload = payload;
  }
}

export class AuthError extends CnpjAbertoError {
  constructor(message: string, status?: number, payload?: unknown) {
    super(message, status, payload);
    this.name = "AuthError";
  }
}

export class NotFoundError extends CnpjAbertoError {
  constructor(message: string, status?: number, payload?: unknown) {
    super(message, status, payload);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends CnpjAbertoError {
  constructor(message: string, status?: number, payload?: unknown) {
    super(message, status, payload);
    this.name = "RateLimitError";
  }
}
