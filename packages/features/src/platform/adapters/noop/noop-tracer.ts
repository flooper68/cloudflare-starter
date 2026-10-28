import type { RequestContext } from "../../../kernel";
import { randomIds } from "../../ids";
import type { Span, Tracer } from "../../ports";
import { newSpanId, newTraceId } from "../../trace-context";

function noopSpan(context: RequestContext): Span {
  const span: Span = {
    context,
    setAttribute: () => span,
    recordException: () => {},
    setStatus: () => span,
    end: () => {},
  };
  return span;
}

/** A new trace for work outside any request, like the recording tracers start. */
function rootContext(): RequestContext {
  return {
    traceId: newTraceId(randomIds),
    spanId: newSpanId(randomIds),
    parentSpanId: null,
    traceFlags: "01",
    source: "cron",
    userId: null,
    workspaceId: null,
    ip: null,
    release: "unknown",
    environment: "unknown",
  };
}

function bind(bound: RequestContext | undefined): Tracer {
  return {
    // Child contexts still get their own span ids, so logs inside a span stay distinct.
    startActiveSpan: (_name, _attributes, fn) => {
      const parent = bound ?? rootContext();
      return fn(
        noopSpan({
          ...parent,
          spanId: newSpanId(randomIds),
          parentSpanId: bound ? parent.spanId : null,
        })
      );
    },
    startContextSpan: (_name, _attributes, fn) =>
      fn(noopSpan(bound ?? rootContext())),
    withContext: (next) => bind(next),
  };
}

/**
 * Tracer that records nothing (`TRACING=none`). It still runs `fn` with a span whose
 * context has its own span id, so callers and logs behave the same with tracing off.
 */
export const noopTracer: Tracer = bind(undefined);
