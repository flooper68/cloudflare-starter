import type { Ids, RequestContext, RequestSource } from "../kernel";

export interface CreateRequestContextInput {
  readonly source: RequestSource;
  readonly release: string;
  readonly environment: string;
  /**
   * An id carried by our own queue messages, so a consumer run shares the id of the request
   * that queued it. Never pass a client header (x-request-id): HTTP ids are generated here.
   */
  readonly requestId?: string | null;
  readonly userId?: string | null;
  readonly workspaceId?: string | null;
  /** cf-connecting-ip for HTTP requests; ignored for queue and cron. */
  readonly ip?: string | null;
}

/** Builds the context of one request, message or cron run at the edge that receives it. */
export function createRequestContext(
  deps: { readonly ids: Ids },
  input: CreateRequestContextInput
): RequestContext {
  return {
    requestId: input.requestId || deps.ids.uuid(),
    source: input.source,
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
    ip: input.source === "http" ? (input.ip ?? null) : null,
    release: input.release,
    environment: input.environment,
  };
}

/**
 * The context fields every log line and error report of that unit of work carries. The IP
 * is left out: it is personal data and has no place in general logs.
 */
export function requestContextFields(
  context: RequestContext
): Readonly<Record<string, string | null>> {
  return {
    requestId: context.requestId,
    source: context.source,
    userId: context.userId,
    workspaceId: context.workspaceId,
    release: context.release,
    environment: context.environment,
  };
}
