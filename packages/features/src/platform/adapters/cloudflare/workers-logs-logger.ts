import type { Clock } from "../../../kernel";
import { systemClock } from "../../clock";
import type { LogResource } from "../../log-record";
import type { Logger } from "../../ports";
import { createRecordLogger } from "../../record-logger";

export interface WorkersLogsLoggerOptions {
  readonly resource: LogResource;
  readonly clock?: Clock;
}

/**
 * Logger adapter for Cloudflare Workers Logs: one OpenTelemetry log record per console
 * call, as an object, which Workers Logs indexes field by field and Workers OTel export
 * forwards (`observability` in wrangler.jsonc). The only place in server code that writes
 * to the console.
 */
export function createWorkersLogsLogger(
  options: WorkersLogsLoggerOptions
): Logger {
  return createRecordLogger({
    resource: options.resource,
    clock: options.clock ?? systemClock,
    write: (record, level) => console[level](record),
  });
}
