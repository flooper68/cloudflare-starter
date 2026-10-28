import type { Clock, Ids, RequestContext } from "../kernel";
import type { LogResource } from "./log-record";
import type { Span, SpanAttributes, SpanStatus, Tracer } from "./ports";
import { requestContextAttributes } from "./request-context";
import { type SpanKind, type SpanRecord, toSpanRecord } from "./span-record";
import { newSpanId, newTraceId } from "./trace-context";

export interface RecordTracerOptions {
  /** Where each finished span record goes (console, a buffer, an OTLP batch). Must not throw. */
  readonly write: (record: SpanRecord) => void;
  readonly resource: LogResource;
  readonly clock: Clock;
  readonly ids: Ids;
}

const KIND_OF_SOURCE: Readonly<Record<RequestContext["source"], SpanKind>> = {
  http: "server",
  queue: "consumer",
  cron: "internal",
  // An operator script (bun run setup:admin) writes D1 through Wrangler; no Worker span.
  script: "internal",
};

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

/** A context for work that starts outside any request (a new trace). */
function rootContext(ids: Ids, resource: LogResource): RequestContext {
  return {
    traceId: newTraceId(ids),
    spanId: newSpanId(ids),
    parentSpanId: null,
    traceFlags: "01",
    source: "cron",
    userId: null,
    workspaceId: null,
    ip: null,
    release: resource["service.version"],
    environment: resource["deployment.environment.name"],
  };
}

/**
 * A Tracer that builds OpenTelemetry span records (span-record.ts) and hands each to
 * `write` when the span ends. Adapters wrap it with their sink, so span ids, nesting,
 * status and exception handling are the same for every adapter.
 */
export function createRecordTracer(
  options: RecordTracerOptions,
  bound?: RequestContext
): Tracer {
  const open = <T>(
    name: string,
    attributes: SpanAttributes,
    spanContext: RequestContext,
    kind: SpanKind,
    fn: (span: Span) => T
  ): T => {
    const start = options.clock.now();
    const own: Record<string, SpanAttributes[string]> = {
      ...requestContextAttributes(spanContext),
      ...attributes,
    };
    const exceptions: { time: Date; error: unknown }[] = [];
    let status: SpanStatus = { code: "unset" };
    let ended = false;

    const span: Span = {
      context: spanContext,
      setAttribute(key, value) {
        if (value !== undefined) own[key] = value;
        return span;
      },
      recordException(error) {
        exceptions.push({ time: options.clock.now(), error });
      },
      setStatus(next) {
        status = next;
        return span;
      },
      end() {
        if (ended) return;
        ended = true;
        try {
          options.write(
            toSpanRecord({
              name,
              kind,
              traceId: spanContext.traceId,
              spanId: spanContext.spanId,
              parentSpanId: spanContext.parentSpanId,
              traceFlags: spanContext.traceFlags,
              start,
              end: options.clock.now(),
              status,
              attributes: own,
              exceptions,
              resource: options.resource,
            })
          );
        } catch {
          // Tracing never fails the work it describes.
        }
      },
    };

    const fail = (error: unknown) => {
      span.recordException(error);
      span.setStatus({
        code: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      span.end();
    };

    let result: T;
    try {
      result = fn(span);
    } catch (error) {
      fail(error);
      throw error;
    }
    if (!isThenable(result)) {
      span.end();
      return result;
    }
    return Promise.resolve(result).then(
      (value) => {
        span.end();
        return value;
      },
      (error: unknown) => {
        fail(error);
        throw error;
      }
    ) as T;
  };

  return {
    startActiveSpan(name, attributes, fn) {
      const parent = bound ?? rootContext(options.ids, options.resource);
      const child: RequestContext = {
        ...parent,
        spanId: newSpanId(options.ids),
        parentSpanId: bound ? parent.spanId : null,
      };
      return open(name, attributes, child, "internal", fn);
    },
    startContextSpan(name, attributes, fn) {
      const context = bound ?? rootContext(options.ids, options.resource);
      return open(
        name,
        attributes,
        context,
        KIND_OF_SOURCE[context.source],
        fn
      );
    },
    withContext: (context) => createRecordTracer(options, context),
  };
}
