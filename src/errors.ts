export class CnpjAbertoError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly payload?: unknown,
    public readonly retryAfter?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
export class AuthError extends CnpjAbertoError {}
/** A 403 remains an AuthError for compatibility with existing consumers. */
export class ForbiddenError extends AuthError {}
export class NotFoundError extends CnpjAbertoError {}
export class RateLimitError extends CnpjAbertoError {}
export class ValidationError extends CnpjAbertoError {}
export class TimeoutError extends CnpjAbertoError {}
export class TransportError extends CnpjAbertoError {}
