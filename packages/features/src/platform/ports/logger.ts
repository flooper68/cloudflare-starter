import type { RequestContext } from "../../kernel";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Attributes of a log record. Use OpenTelemetry semantic-convention keys where one exists
 * (`http.request.method`, `url.path`, `user.id`, `messaging.message.id`) and namespaced
 * `app.*` keys otherwise (`app.queue.attempts`). An Error under the key `error` becomes the
 * `exception.type`, `exception.message` and `exception.stacktrace` attributes.
 */
export type LogFields = Readonly<Record<string, unknown>>;

/**
 * Port: structured logging in the OpenTelemetry Logs Data Model. `event` is the record's
 * body, a stable dotted name (`queue.hello`, `error.captured`) that queries filter on.
 * Implementations live in `platform/adapters/<vendor>/` and pass `describeLoggerContract`
 * (logger.contract.ts). Logging never throws, whatever the attributes hold.
 */
export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** A logger that adds `fields` to every record. Never changes this logger. */
  child(fields: LogFields): Logger;
  /**
   * A logger whose records carry this unit of work's `trace_id`, `span_id` and context
   * attributes (`user.id`, `app.workspace.id`, `app.request.source`). Never changes this
   * logger.
   */
  withContext(context: RequestContext): Logger;
}
