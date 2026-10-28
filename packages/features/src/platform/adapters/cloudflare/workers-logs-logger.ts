import { toLogRecord } from "../../log-record";
import type { LogFields, Logger, LogLevel } from "../../ports";

/**
 * Logger adapter for Cloudflare Workers Logs: one structured object per line on the
 * console, which Workers Logs indexes field by field (`observability.logs` in
 * wrangler.jsonc). Secrets are redacted, errors serialized and circular references cut
 * by `toLogRecord`. The only place in server code that writes to the console.
 */
export function createWorkersLogsLogger(fields: LogFields = {}): Logger {
  const write = (level: LogLevel, event: string, extra?: LogFields) => {
    console[level](toLogRecord(level, event, extra, fields));
  };
  return {
    debug: (event, extra) => write("debug", event, extra),
    info: (event, extra) => write("info", event, extra),
    warn: (event, extra) => write("warn", event, extra),
    error: (event, extra) => write("error", event, extra),
    child: (more) => createWorkersLogsLogger({ ...fields, ...more }),
  };
}
