/** What kind of failure a domain error is; adapters map it to a transport error. */
export type DomainErrorKind =
  | "not_found"
  | "invalid_input"
  | "forbidden"
  | "conflict"
  | "unavailable"
  | "rate_limited"
  /** The workspace's plan does not include a feature, or a usage limit is reached. */
  | "limit_reached";

/**
 * Machine-readable facts about a domain error that clients and agents act on, such as the
 * metric, limit and upgrade options of `limit_reached`. Adapters pass them through as they
 * are (tRPC `data.domain.details`, MCP tool errors, Problem Details extension members), so
 * they hold identifiers and numbers only, never secrets or user data.
 */
export type DomainErrorDetails = Readonly<Record<string, unknown>>;

/**
 * Base class for errors a use case throws on purpose. Features subclass it
 * (`FileNotFoundError`); adapters map `kind` to tRPC codes or HTTP statuses in one place.
 * `code` names the case for clients to branch on; `details` carry its facts
 * (`LIMIT_REACHED` with the metric, limit and upgrade options).
 */
export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  /** Optional stable code clients can branch on (`NOT_A_WORKSPACE_MEMBER`). */
  readonly code: string | undefined;
  readonly details: DomainErrorDetails | undefined;

  constructor(
    kind: DomainErrorKind,
    message: string,
    code?: string,
    details?: DomainErrorDetails
  ) {
    super(message);
    this.name = new.target.name;
    this.kind = kind;
    this.code = code;
    this.details = details;
  }
}
