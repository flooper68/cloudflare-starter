/**
 * The Tracer contract: every adapter's `*.contract.test.ts` runs this suite against it.
 * Spans follow the OpenTelemetry trace data model (see ../span-record.ts).
 * Test support only (not exported from the barrel, not bundled).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { RequestContext } from "../../kernel";
import type { Tracer } from "./tracer";

/** One span as the adapter recorded or emitted it. */
export type ObservedSpan = Readonly<{
  name?: unknown;
  kind?: unknown;
  trace_id?: unknown;
  span_id?: unknown;
  parent_span_id?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  duration_ms?: unknown;
  status?: Readonly<{ code?: unknown; message?: unknown }>;
  attributes?: Readonly<Record<string, unknown>>;
  events?: readonly Readonly<{
    name?: unknown;
    attributes?: Readonly<Record<string, unknown>>;
  }>[];
  resource?: unknown;
}>;

export interface TracerHarness {
  readonly tracer: Tracer;
  /** Ended spans, in the order they ended. Omit for adapters that discard everything (noop). */
  readonly spans?: () => readonly ObservedSpan[];
  readonly dispose?: () => void;
}

export const TRACER_CONTRACT_CONTEXT: RequestContext = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  parentSpanId: "b7ad6b7169203331",
  traceFlags: "01",
  source: "http",
  userId: "user-1",
  workspaceId: null,
  ip: "203.0.113.7",
  release: "local",
  environment: "local",
};

const SPAN_ID = /^[0-9a-f]{16}$/;

export function describeTracerContract(
  name: string,
  makeHarness: () => TracerHarness
): void {
  describe(`${name} satisfies the Tracer contract`, () => {
    const made: TracerHarness[] = [];
    const harness = () => {
      const created = makeHarness();
      made.push(created);
      return created;
    };
    afterEach(() => {
      for (const created of made.splice(0)) created.dispose?.();
    });

    it("returns what fn returns, sync and async, and rethrows what it throws", async () => {
      const { tracer } = harness();
      const bound = tracer.withContext(TRACER_CONTRACT_CONTEXT);
      expect(bound.startActiveSpan("sync", {}, () => 42)).toBe(42);
      await expect(
        bound.startActiveSpan("async", {}, async () => "done")
      ).resolves.toBe("done");
      const boom = new RangeError("boom");
      expect(() =>
        bound.startActiveSpan("throws", {}, () => {
          throw boom;
        })
      ).toThrow(boom);
      await expect(
        bound.startContextSpan("rejects", {}, async () => {
          throw boom;
        })
      ).rejects.toBe(boom);
    });

    it("gives the child span the bound trace, a new span id and the bound span as parent", () => {
      const { tracer } = harness();
      tracer
        .withContext(TRACER_CONTRACT_CONTEXT)
        .startActiveSpan("child", {}, (span) => {
          expect(span.context.traceId).toBe(TRACER_CONTRACT_CONTEXT.traceId);
          expect(span.context.spanId).toMatch(SPAN_ID);
          expect(span.context.spanId).not.toBe(TRACER_CONTRACT_CONTEXT.spanId);
          expect(span.context.parentSpanId).toBe(
            TRACER_CONTRACT_CONTEXT.spanId
          );
          expect(span.context.userId).toBe("user-1");
        });
    });

    it("never throws from span methods, whatever they are given", () => {
      const { tracer } = harness();
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() =>
        tracer.startActiveSpan("awkward", {}, (span) => {
          span.setAttribute("app.n", undefined);
          span.recordException(circular);
          span.recordException(null);
          span.setStatus({ code: "error", message: "x" });
          span.end();
          span.end();
        })
      ).not.toThrow();
    });

    const observable = makeHarness();
    observable.dispose?.();
    if (!observable.spans) return;

    it("records one OpenTelemetry span per span: ids, times, duration, status, attributes, resource", async () => {
      const { tracer, spans } = harness();
      await tracer
        .withContext(TRACER_CONTRACT_CONTEXT)
        .startActiveSpan(
          "storage.listFiles",
          { "rpc.method": "storage.listFiles" },
          async (span) => {
            span.setAttribute("app.items", 3).setStatus({ code: "ok" });
          }
        );
      const all = spans?.() ?? [];
      expect(all).toHaveLength(1);
      const [span] = all;
      expect(span).toMatchObject({
        name: "storage.listFiles",
        kind: "internal",
        trace_id: TRACER_CONTRACT_CONTEXT.traceId,
        parent_span_id: TRACER_CONTRACT_CONTEXT.spanId,
        status: { code: "ok" },
        attributes: {
          "rpc.method": "storage.listFiles",
          "app.items": 3,
          "user.id": "user-1",
          "app.request.source": "http",
        },
        resource: {
          "service.name": expect.any(String),
          "service.version": expect.any(String),
          "deployment.environment.name": expect.any(String),
        },
      });
      expect(span?.span_id).toMatch(SPAN_ID);
      expect(typeof span?.duration_ms).toBe("number");
      expect(Date.parse(String(span?.end_time))).toBeGreaterThanOrEqual(
        Date.parse(String(span?.start_time))
      );
      expect(JSON.stringify(span)).not.toContain("203.0.113.7");
    });

    it("records the context's own span with startContextSpan (server kind for HTTP)", () => {
      const { tracer, spans } = harness();
      tracer
        .withContext(TRACER_CONTRACT_CONTEXT)
        .startContextSpan("GET /api/hello", {}, () => undefined);
      expect(spans?.()[0]).toMatchObject({
        name: "GET /api/hello",
        kind: "server",
        span_id: TRACER_CONTRACT_CONTEXT.spanId,
        parent_span_id: TRACER_CONTRACT_CONTEXT.parentSpanId,
      });
    });

    it("nests: a child of a span's context has that span as parent, and ends first", () => {
      const { tracer, spans } = harness();
      tracer
        .withContext(TRACER_CONTRACT_CONTEXT)
        .startActiveSpan("outer", {}, (outer) =>
          tracer
            .withContext(outer.context)
            .startActiveSpan("inner", {}, () => undefined)
        );
      const [inner, outer] = spans?.() ?? [];
      expect(inner?.name).toBe("inner");
      expect(outer?.name).toBe("outer");
      expect(inner?.parent_span_id).toBe(outer?.span_id);
    });

    it("records a thrown error as an exception event and an error status", async () => {
      const { tracer, spans } = harness();
      await tracer
        .withContext(TRACER_CONTRACT_CONTEXT)
        .startActiveSpan("fails", {}, async () => {
          throw new TypeError("bad input");
        })
        .catch(() => undefined);
      expect(spans?.()[0]).toMatchObject({
        status: { code: "error", message: "bad input" },
        events: [
          {
            name: "exception",
            attributes: {
              "exception.type": "TypeError",
              "exception.message": "bad input",
            },
          },
        ],
      });
    });

    it("records a span once, however often end() is called", () => {
      const { tracer, spans } = harness();
      tracer.startActiveSpan("ended-by-hand", {}, (span) => {
        span.end();
        span.end();
      });
      expect(spans?.()).toHaveLength(1);
    });

    it("redacts secrets in span attributes by key", () => {
      const { tracer, spans } = harness();
      tracer.startActiveSpan(
        "secret",
        { "http.request.header.authorization": "Bearer abc" },
        () => undefined
      );
      expect(JSON.stringify(spans?.())).not.toContain("Bearer abc");
    });
  });
}
