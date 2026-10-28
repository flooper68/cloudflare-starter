/** Shape of a W3C `traceparent` header value (version-00 form), for message schemas. */
export const TRACEPARENT_PATTERN =
  /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/** Which edge started the work: an HTTP request, a queue message or a cron run. */
export type RequestSource = "http" | "queue" | "cron";

/**
 * Who and what one unit of work is about, built once at the edge (middleware, queue
 * consumer, cron handler) and passed to logs and error reports. Its identity is a W3C
 * Trace Context: `traceId` (32 lowercase hex) is the id of the whole operation and the
 * reference users quote (also sent as `x-request-id`); `spanId` (16 hex) is this unit of
 * work. There is no separate request id. `ip` is set for HTTP requests only.
 */
export interface RequestContext {
  readonly traceId: string;
  readonly spanId: string;
  /** The span that caused this one (an incoming `traceparent`, or the producer of a message). */
  readonly parentSpanId: string | null;
  /** W3C trace-flags, two hex digits; "01" when sampled. */
  readonly traceFlags: string;
  readonly source: RequestSource;
  readonly userId: string | null;
  readonly workspaceId: string | null;
  readonly ip: string | null;
  /** The deployed Worker version (version_metadata id); "local" in dev and tests. */
  readonly release: string;
  /** APP_ENV: local, develop, staging, production. */
  readonly environment: string;
}
