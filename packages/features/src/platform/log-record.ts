/**
 * Log records in the OpenTelemetry Logs Data Model
 * (https://opentelemetry.io/docs/specs/otel/logs/data-model/), serialized as JSON with
 * snake_case field names. Shared by every logging adapter so redaction, exception mapping
 * and the resource behave the same whichever sink is used.
 */
import type { RequestContext } from "../kernel";
import type { LogFields, LogLevel } from "./ports";
import { requestContextAttributes } from "./request-context";

export type SeverityText = "DEBUG" | "INFO" | "WARN" | "ERROR";

/** Resource attributes: what emitted the record (OpenTelemetry resource conventions). */
export interface LogResource {
  readonly "service.name": string;
  /** The deployed version (version_metadata id), "local" in dev. */
  readonly "service.version": string;
  readonly "deployment.environment.name": string;
}

export interface LogRecord {
  /** ISO 8601 time the record was created. */
  readonly timestamp: string;
  readonly severity_text: SeverityText;
  /** OpenTelemetry severity number: DEBUG 5, INFO 9, WARN 13, ERROR 17. */
  readonly severity_number: number;
  /** The event name. */
  readonly body: string;
  readonly trace_id?: string;
  readonly span_id?: string;
  readonly trace_flags?: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly resource: LogResource;
}

const SEVERITY: Record<LogLevel, readonly [SeverityText, number]> = {
  debug: ["DEBUG", 5],
  info: ["INFO", 9],
  warn: ["WARN", 13],
  error: ["ERROR", 17],
};

/** Keys whose values never reach a log: credentials, tokens, cookies, signatures. */
const SECRET_KEY =
  /pass(word|phrase)?$|secret|token|authorization|cookie|api[-_]?key|private[-_]?key|credential|signature/i;
export const REDACTED = "[redacted]";
const MAX_DEPTH = 8;
const MAX_STRING = 8192;

function truncate(value: string): string {
  return value.length > MAX_STRING
    ? `${value.slice(0, MAX_STRING)}…[truncated ${value.length - MAX_STRING} chars]`
    : value;
}

function sanitizeObject(
  entries: Iterable<[string, unknown]>,
  ancestors: readonly object[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (value === undefined) continue;
    out[key] = SECRET_KEY.test(key) ? REDACTED : sanitize(value, ancestors);
  }
  return out;
}

/** Errors nested in attributes become `{ name, message, stack }` plus their own fields. */
function sanitizeError(
  error: Error,
  ancestors: readonly object[]
): Record<string, unknown> {
  return {
    name: error.name,
    message: truncate(error.message),
    ...(error.stack ? { stack: truncate(error.stack) } : {}),
    ...sanitizeObject(
      Object.entries(error).filter(
        ([key]) => key !== "name" && key !== "message" && key !== "stack"
      ),
      ancestors
    ),
    ...(error.cause !== undefined
      ? { cause: sanitize(error.cause, ancestors) }
      : {}),
  };
}

/**
 * Turns any value into JSON-safe data: secrets redacted by key, errors serialized,
 * circular references and very deep nesting replaced by markers, long strings cut.
 * Never throws.
 */
export function sanitize(
  value: unknown,
  ancestors: readonly object[] = []
): unknown {
  switch (typeof value) {
    case "string":
      return truncate(value);
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "undefined":
      return null;
    case "symbol":
      return value.toString();
    case "function":
      return "[function]";
  }
  if (value === null) return null;
  const object = value as object;
  if (ancestors.includes(object)) return "[circular]";
  if (ancestors.length >= MAX_DEPTH) return "[depth limit]";
  const next = [...ancestors, object];
  try {
    if (object instanceof Error) return sanitizeError(object, next);
    if (object instanceof Date) {
      return Number.isNaN(object.getTime())
        ? "Invalid Date"
        : object.toISOString();
    }
    if (object instanceof URL) return object.toString();
    if (ArrayBuffer.isView(object) || object instanceof ArrayBuffer) {
      return `[binary ${object.byteLength} bytes]`;
    }
    if (Array.isArray(object))
      return object.map((item) => sanitize(item, next));
    if (object instanceof Map) {
      return sanitizeObject(
        [...object.entries()].map(([key, item]) => [String(key), item]),
        next
      );
    }
    if (object instanceof Set)
      return [...object].map((item) => sanitize(item, next));
    return sanitizeObject(Object.entries(object), next);
  } catch {
    // A throwing getter or proxy: keep the record, lose the value.
    return "[unserializable]";
  }
}

/**
 * The OpenTelemetry exception attributes of a thrown value
 * (https://opentelemetry.io/docs/specs/semconv/exceptions/).
 */
export function exceptionAttributes(
  thrown: unknown
): Readonly<Record<string, unknown>> {
  try {
    if (thrown instanceof Error) {
      const own = sanitizeObject(
        Object.entries(thrown).filter(
          ([key]) => key !== "name" && key !== "message" && key !== "stack"
        ),
        [thrown]
      );
      return {
        "exception.type": thrown.name,
        "exception.message": truncate(thrown.message),
        ...(thrown.stack
          ? { "exception.stacktrace": truncate(thrown.stack) }
          : {}),
        ...(Object.keys(own).length ? { "app.exception.fields": own } : {}),
        ...(thrown.cause !== undefined
          ? { "app.exception.cause": sanitize(thrown.cause, [thrown]) }
          : {}),
      };
    }
    const message = sanitize(thrown);
    return {
      "exception.type": thrown === null ? "null" : typeof thrown,
      "exception.message":
        typeof message === "string" ? message : JSON.stringify(message),
    };
  } catch {
    return {
      "exception.type": "unknown",
      "exception.message": "[unserializable]",
    };
  }
}

/** Attributes as given, made safe; an Error under `error` becomes the exception.* attributes. */
function toAttributes(fields: LogFields): Record<string, unknown> {
  const { error, ...rest } = fields;
  return {
    ...sanitizeObject(Object.entries(rest), []),
    ...(error !== undefined ? exceptionAttributes(error) : {}),
  };
}

export interface LogRecordInput {
  readonly level: LogLevel;
  readonly event: string;
  readonly fields?: LogFields;
  /** Attributes bound by `child()`; the call's own fields win on a clash. */
  readonly bound?: LogFields;
  readonly context?: RequestContext;
  readonly resource: LogResource;
  readonly now: Date;
}

/** Builds one record. Never throws. */
export function toLogRecord(input: LogRecordInput): LogRecord {
  const [severity_text, severity_number] = SEVERITY[input.level];
  let attributes: Record<string, unknown>;
  try {
    attributes = toAttributes({
      ...(input.context ? requestContextAttributes(input.context) : {}),
      ...(input.bound ?? {}),
      ...(input.fields ?? {}),
    });
  } catch {
    attributes = { "app.log.attributes": "[unserializable]" };
  }
  return {
    timestamp: input.now.toISOString(),
    severity_text,
    severity_number,
    body: input.event,
    ...(input.context
      ? {
          trace_id: input.context.traceId,
          span_id: input.context.spanId,
          trace_flags: input.context.traceFlags,
        }
      : {}),
    attributes,
    resource: input.resource,
  };
}
