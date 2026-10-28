/**
 * Small helpers the edges share to describe their work in OpenTelemetry terms (HTTP in
 * http.ts, tRPC in trpc/init.ts, MCP tools in mcp/server.ts, queue.ts, cron.ts). The spans
 * and metrics themselves are recorded there, once per unit of work, never in use cases.
 * Guide: docs/guides/how-to-setup-metrics-and-tracing.md
 */
import type { Clock } from "@cloudflare-starter/features";

/** HTTP methods OpenTelemetry knows; anything else is recorded as `_OTHER`. */
const KNOWN_METHODS = new Set([
  "CONNECT",
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
  "QUERY",
  "TRACE",
]);

/** `http.request.method` as the semantic conventions bound it (no arbitrary methods). */
export function httpMethodAttribute(method: string): string {
  return KNOWN_METHODS.has(method) ? method : "_OTHER";
}

/** Seconds since `start`, never negative. Workers advance the clock only on I/O. */
export function secondsSince(clock: Clock, start: Date): number {
  return Math.max(0, (clock.now().getTime() - start.getTime()) / 1000);
}

/**
 * `error.type` of a thrown value: the error's class name (`TypeError`, `D1_ERROR`), or
 * `_OTHER` for anything that is not an Error. Low cardinality: never the message.
 */
export function errorTypeOf(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "_OTHER";
}
