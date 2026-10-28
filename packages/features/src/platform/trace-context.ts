/**
 * W3C Trace Context (https://www.w3.org/TR/trace-context/): the `traceparent` header
 * `00-<trace-id>-<parent-id>-<trace-flags>`. Parsing is strict; anything invalid is
 * ignored and a new trace starts. An incoming trace id is used for correlation only,
 * never for authorization: any client can choose it.
 */
import type { Ids, RequestContext } from "../kernel";

export interface TraceParent {
  readonly traceId: string;
  readonly parentSpanId: string;
  readonly traceFlags: string;
}

const TRACEPARENT =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})(-[\x21-\x7e]*)?$/;
const ZERO_TRACE = "0".repeat(32);
const ZERO_SPAN = "0".repeat(16);

/** The parsed header, or null when it is missing or invalid. */
export function parseTraceparent(
  header: string | null | undefined
): TraceParent | null {
  if (!header || header.length > 512) return null;
  const match = TRACEPARENT.exec(header.trim());
  if (!match) return null;
  const [, version, traceId, parentSpanId, traceFlags, rest] =
    match as unknown as [
      string,
      string,
      string,
      string,
      string,
      string | undefined,
    ];
  // Version ff is invalid; version 00 has exactly four fields; later versions may add more.
  if (version === "ff" || (version === "00" && rest)) return null;
  if (traceId === ZERO_TRACE || parentSpanId === ZERO_SPAN) return null;
  return { traceId, parentSpanId, traceFlags };
}

/** The `traceparent` that continues from this context (its span becomes the parent). */
export function formatTraceparent(
  context: Pick<RequestContext, "traceId" | "spanId" | "traceFlags">
): string {
  return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`;
}

function hex(ids: Ids): string {
  return ids.uuid().replaceAll("-", "").toLowerCase();
}

/** A new random trace id (32 hex, never all zeros). */
export function newTraceId(ids: Ids): string {
  const id = hex(ids).padEnd(32, "0").slice(0, 32);
  return id === ZERO_TRACE ? `${id.slice(0, 31)}1` : id;
}

/** A new random span id (16 hex, never all zeros). */
export function newSpanId(ids: Ids): string {
  const id = hex(ids).padEnd(16, "0").slice(-16);
  return id === ZERO_SPAN ? `${id.slice(0, 15)}1` : id;
}
