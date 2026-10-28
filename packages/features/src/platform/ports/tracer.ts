import type { RequestContext } from "../../kernel";

/** A span attribute value: OpenTelemetry primitives. */
export type SpanAttributeValue = string | number | boolean;
export type SpanAttributes = Readonly<
  Record<string, SpanAttributeValue | undefined>
>;

/** OpenTelemetry span status: unset (the default), ok, or error with a message. */
export interface SpanStatus {
  readonly code: "unset" | "ok" | "error";
  readonly message?: string;
}

/** One span, shaped on the OpenTelemetry Span API. */
export interface Span {
  /**
   * The context of the work inside this span: same trace id, this span's id as `spanId`
   * and its parent as `parentSpanId`. Bind loggers and child tracers to it.
   */
  readonly context: RequestContext;
  /** Sets an attribute; `undefined` is ignored. Use semantic-convention or `app.*` keys. */
  setAttribute(key: string, value: SpanAttributeValue | undefined): Span;
  /** Adds an `exception` event with the exception.* attributes. Does not set the status. */
  recordException(error: unknown): void;
  setStatus(status: SpanStatus): Span;
  /** Ends the span. Idempotent; `startActiveSpan` ends its span itself. */
  end(): void;
}

/**
 * Port: tracing in the shape of the OpenTelemetry tracing API, on the W3C trace of the
 * request context. `startActiveSpan` runs `fn` in a child span of the bound context (a new
 * span id, the bound span as parent), ends it when `fn` returns or its promise settles,
 * and on a throw or rejection records the exception, sets the status to error and rethrows.
 * `startContextSpan` does the same for the span the bound context itself names (its
 * `spanId`): the edges use it once per HTTP request, queue message and cron run. Tracing
 * never throws on its own and never changes what `fn` returns. Implementations pass
 * `describeTracerContract` (tracer.contract.ts).
 */
export interface Tracer {
  startActiveSpan<T>(
    name: string,
    attributes: SpanAttributes,
    fn: (span: Span) => T
  ): T;
  startContextSpan<T>(
    name: string,
    attributes: SpanAttributes,
    fn: (span: Span) => T
  ): T;
  /** A tracer whose spans belong to this unit of work. Never changes this tracer. */
  withContext(context: RequestContext): Tracer;
}
