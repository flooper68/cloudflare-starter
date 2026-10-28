import type { LogFields, LogLevel } from "./ports";

/** One structured log line: level and event first, then the fields, all JSON-safe. */
export type LogRecord = Readonly<Record<string, unknown>> & {
  readonly level: LogLevel;
  readonly event: string;
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

/** Errors become `{ name, message, stack }` plus their own fields (`code`, `kind`, `cause`). */
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
    // A throwing getter or proxy: keep the line, lose the value.
    return "[unserializable]";
  }
}

/**
 * Builds one log line. `base` are the logger's bound fields (child loggers), `fields` the
 * call's own; the call wins on a clash, and neither can overwrite `level` or `event`.
 * Shared by every logging adapter so redaction behaves the same whichever sink is used.
 */
export function toLogRecord(
  level: LogLevel,
  event: string,
  fields: LogFields | undefined,
  base: LogFields = {}
): LogRecord {
  try {
    const merged = sanitizeObject(
      Object.entries({ ...base, ...(fields ?? {}) }).filter(
        ([key]) => key !== "level" && key !== "event"
      ),
      []
    );
    return { level, event, ...merged };
  } catch {
    return { level, event, fields: "[unserializable]" };
  }
}
