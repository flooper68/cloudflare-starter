import type { Clock, RequestContext } from "../kernel";
import { type LogRecord, type LogResource, toLogRecord } from "./log-record";
import type { LogFields, Logger, LogLevel } from "./ports";

export interface RecordLoggerOptions {
  /** Where each finished record goes (console, a buffer, an HTTP batch). Must not throw. */
  readonly write: (record: LogRecord, level: LogLevel) => void;
  readonly resource: LogResource;
  readonly clock: Clock;
}

/**
 * A Logger that builds OpenTelemetry log records and hands them to `write`. Adapters wrap
 * it with their sink, so child/withContext semantics are the same for every adapter.
 */
export function createRecordLogger(
  options: RecordLoggerOptions,
  bound: LogFields = {},
  context?: RequestContext
): Logger {
  const emit = (level: LogLevel, event: string, fields?: LogFields) => {
    try {
      options.write(
        toLogRecord({
          level,
          event,
          fields,
          bound,
          context,
          resource: options.resource,
          now: options.clock.now(),
        }),
        level
      );
    } catch {
      // Logging never fails the work it describes.
    }
  };
  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    child: (more) =>
      createRecordLogger(options, { ...bound, ...more }, context),
    withContext: (next) => createRecordLogger(options, bound, next),
  };
}
