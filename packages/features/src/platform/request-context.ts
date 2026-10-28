import type { Ids, RequestContext, RequestSource } from "../kernel";
import { newSpanId, newTraceId, parseTraceparent } from "./trace-context";

export interface CreateRequestContextInput {
  readonly source: RequestSource;
  readonly release: string;
  readonly environment: string;
  /**
   * A W3C `traceparent` to continue: the incoming header of an HTTP request, or the one a
   * queue message carries. Invalid or missing starts a new trace. This unit of work always
   * gets its own span id. Correlation only: never trust it for anything else.
   */
  readonly traceparent?: string | null;
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
  const parent = parseTraceparent(input.traceparent);
  return {
    traceId: parent?.traceId ?? newTraceId(deps.ids),
    spanId: newSpanId(deps.ids),
    parentSpanId: parent?.parentSpanId ?? null,
    traceFlags: parent?.traceFlags ?? "01",
    source: input.source,
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
    ip: input.source === "http" ? (input.ip ?? null) : null,
    release: input.release,
    environment: input.environment,
  };
}

/**
 * The context as OpenTelemetry log attributes (semantic conventions where they exist,
 * `app.*` otherwise). Absent values are left out. The IP is personal data and is never
 * an attribute; trace and span ids are top-level fields of the record, not attributes.
 */
export function requestContextAttributes(
  context: RequestContext
): Readonly<Record<string, string>> {
  const attributes: Record<string, string> = {
    "app.request.source": context.source,
  };
  if (context.userId) attributes["user.id"] = context.userId;
  if (context.workspaceId) attributes["app.workspace.id"] = context.workspaceId;
  return attributes;
}
