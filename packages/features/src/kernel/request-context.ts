/** Which edge started the work: an HTTP request, a queue message or a cron run. */
export type RequestSource = "http" | "queue" | "cron";

/**
 * Who and what one unit of work is about, built once at the edge (middleware, queue
 * consumer, cron handler) and passed to logs and error reports. `requestId` is generated
 * server-side and is the reference users quote; `ip` is set for HTTP requests only.
 */
export interface RequestContext {
  readonly requestId: string;
  readonly source: RequestSource;
  readonly userId: string | null;
  readonly workspaceId: string | null;
  readonly ip: string | null;
  /** The deployed Worker version (version_metadata id); "local" in dev and tests. */
  readonly release: string;
  /** APP_ENV: local, develop, staging, production. */
  readonly environment: string;
}
