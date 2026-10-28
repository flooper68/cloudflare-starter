import { type LogRecord, toLogRecord } from "../../log-record";
import type { LogFields, Logger, LogLevel } from "../../ports";

/** A logger that keeps its lines in memory; children share the parent's list. */
export interface MemoryLogger extends Logger {
  readonly records: readonly LogRecord[];
  child(fields: LogFields): MemoryLogger;
}

function build(records: LogRecord[], fields: LogFields): MemoryLogger {
  const write = (level: LogLevel, event: string, extra?: LogFields) => {
    records.push(toLogRecord(level, event, extra, fields));
  };
  return {
    records,
    debug: (event, extra) => write("debug", event, extra),
    info: (event, extra) => write("info", event, extra),
    warn: (event, extra) => write("warn", event, extra),
    error: (event, extra) => write("error", event, extra),
    child: (more) => build(records, { ...fields, ...more }),
  };
}

/** Logger for tests: assert on `records` instead of spying on the console. */
export function createMemoryLogger(): MemoryLogger {
  return build([], {});
}
