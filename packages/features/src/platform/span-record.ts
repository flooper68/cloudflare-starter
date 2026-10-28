/**
 * Spans as records in the OpenTelemetry trace data model
 * (https://opentelemetry.io/docs/specs/otel/trace/api/#span), serialized as JSON with
 * snake_case field names like the log records (log-record.ts). Each record is also a valid
 * log record (timestamp, severity, body `trace.span`, trace_id, span_id, resource), so a
 * log sink such as Workers Logs indexes and exports it next to the request's logs.
 */
import { exceptionAttributes, type LogResource, sanitize } from "./log-record";
import type { SpanAttributes, SpanStatus } from "./ports";

/** The body of every span record; filter on it to list spans. */
export const SPAN_EVENT = "trace.span";

/** OpenTelemetry span kinds. */
export type SpanKind = "server" | "consumer" | "internal";

export interface SpanEventRecord {
  readonly name: string;
  readonly time: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface SpanRecord {
  /** ISO 8601 end time (the record's own timestamp as a log record). */
  readonly timestamp: string;
  /** INFO, or ERROR when the status is error. */
  readonly severity_text: "INFO" | "ERROR";
  readonly severity_number: 9 | 17;
  readonly body: typeof SPAN_EVENT;
  /** The span name: `GET /api/files`, `storage.listFiles`, `process <queue>`. */
  readonly name: string;
  readonly kind: SpanKind;
  readonly trace_id: string;
  readonly span_id: string;
  /** The parent span, absent for a root span. */
  readonly parent_span_id?: string;
  readonly trace_flags: string;
  readonly start_time: string;
  readonly end_time: string;
  /** end_time minus start_time in milliseconds. */
  readonly duration_ms: number;
  readonly status: SpanStatus;
  readonly attributes: Readonly<Record<string, unknown>>;
  /** `exception` events from `recordException`. */
  readonly events: readonly SpanEventRecord[];
  readonly resource: LogResource;
}

export interface SpanRecordInput {
  readonly name: string;
  readonly kind: SpanKind;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly traceFlags: string;
  readonly start: Date;
  readonly end: Date;
  readonly status: SpanStatus;
  readonly attributes: SpanAttributes;
  readonly exceptions: readonly {
    readonly time: Date;
    readonly error: unknown;
  }[];
  readonly resource: LogResource;
}

/** Builds one span record: attributes made JSON-safe and redacted. Never throws. */
export function toSpanRecord(input: SpanRecordInput): SpanRecord {
  let attributes: Record<string, unknown>;
  try {
    attributes = sanitize(
      Object.fromEntries(
        Object.entries(input.attributes).filter(
          ([, value]) => value !== undefined
        )
      )
    ) as Record<string, unknown>;
  } catch {
    attributes = { "app.span.attributes": "[unserializable]" };
  }
  const error = input.status.code === "error";
  return {
    timestamp: input.end.toISOString(),
    severity_text: error ? "ERROR" : "INFO",
    severity_number: error ? 17 : 9,
    body: SPAN_EVENT,
    name: input.name,
    kind: input.kind,
    trace_id: input.traceId,
    span_id: input.spanId,
    ...(input.parentSpanId ? { parent_span_id: input.parentSpanId } : {}),
    trace_flags: input.traceFlags,
    start_time: input.start.toISOString(),
    end_time: input.end.toISOString(),
    duration_ms: Math.max(0, input.end.getTime() - input.start.getTime()),
    status: input.status,
    attributes,
    events: input.exceptions.map(({ time, error: thrown }) => ({
      name: "exception",
      time: time.toISOString(),
      attributes: exceptionAttributes(thrown),
    })),
    resource: input.resource,
  };
}
