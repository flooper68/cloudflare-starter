export type LogLevel = "debug" | "info" | "warn" | "error";

/** Structured fields of a log line. Values may be anything; adapters make them safe to emit. */
export type LogFields = Readonly<Record<string, unknown>>;

/**
 * Port: structured logging. `event` is a stable dotted name (`queue.hello`, `http.error`)
 * that log queries filter on; details go in `fields`. Implementations live in
 * `platform/adapters/<vendor>/` and pass `describeLoggerContract` (logger.contract.ts).
 * Logging never throws, whatever the fields hold.
 */
export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** A logger that adds `fields` to every line. Never changes this logger. */
  child(fields: LogFields): Logger;
}
