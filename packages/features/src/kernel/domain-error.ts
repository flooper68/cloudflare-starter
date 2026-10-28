/** What kind of failure a domain error is; adapters map it to a transport error. */
export type DomainErrorKind =
  | "not_found"
  | "invalid_input"
  | "forbidden"
  | "conflict"
  | "unavailable";

/**
 * Base class for errors a use case throws on purpose. Features subclass it
 * (`FileNotFoundError`); adapters map `kind` to tRPC codes or HTTP statuses in one place.
 */
export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  /** Optional stable code clients can branch on (`NOT_A_WORKSPACE_MEMBER`). */
  readonly code: string | undefined;

  constructor(kind: DomainErrorKind, message: string, code?: string) {
    super(message);
    this.name = new.target.name;
    this.kind = kind;
    this.code = code;
  }
}
