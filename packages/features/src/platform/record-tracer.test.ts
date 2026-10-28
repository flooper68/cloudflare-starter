import { describe, expect, it } from "vitest";

import type { Clock, Ids, RequestContext } from "../kernel";
import { TEST_RESOURCE } from "./adapters/memory/memory-logger";
import { createRecordTracer } from "./record-tracer";
import type { SpanRecord } from "./span-record";

const context: RequestContext = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  parentSpanId: null,
  traceFlags: "01",
  source: "queue",
  userId: null,
  workspaceId: null,
  ip: null,
  release: "local",
  environment: "test",
};

/** A clock that advances 25 ms on every read. */
function steppingClock(): Clock {
  let ms = Date.parse("2026-10-28T12:00:00.000Z");
  return {
    now: () => {
      const now = new Date(ms);
      ms += 25;
      return now;
    },
  };
}

const ids: Ids = {
  uuid: () => "a1b2c3d4-e5f6-4789-8abc-def012345678",
};

function tracer() {
  const spans: SpanRecord[] = [];
  return {
    spans,
    tracer: createRecordTracer({
      resource: TEST_RESOURCE,
      clock: steppingClock(),
      ids,
      write: (record) => spans.push(record),
    }),
  };
}

describe("record tracer", () => {
  it("creates child span ids from the ids port: 16 hex, the last 16 of the uuid", () => {
    const { tracer: t } = tracer();
    t.withContext(context).startActiveSpan("child", {}, (span) => {
      expect(span.context.spanId).toBe("8abcdef012345678");
    });
  });

  it("times a span with the clock: start, end and duration in milliseconds", async () => {
    const { tracer: t, spans } = tracer();
    await t
      .withContext(context)
      .startActiveSpan("work", {}, async () => undefined);
    expect(spans[0]).toMatchObject({
      start_time: "2026-10-28T12:00:00.000Z",
      end_time: "2026-10-28T12:00:00.025Z",
      duration_ms: 25,
      timestamp: "2026-10-28T12:00:00.025Z",
      body: "trace.span",
      severity_text: "INFO",
    });
  });

  it("gives the context span the kind of its source: consumer for a queue message", () => {
    const { tracer: t, spans } = tracer();
    t.withContext(context).startContextSpan("process q", {}, () => undefined);
    expect(spans[0]).toMatchObject({
      kind: "consumer",
      span_id: context.spanId,
    });
    expect(spans[0]).not.toHaveProperty("parent_span_id");
  });

  it("writes an error span as an ERROR record", () => {
    const { tracer: t, spans } = tracer();
    expect(() =>
      t.startActiveSpan("fails", {}, () => {
        throw new Error("nope");
      })
    ).toThrow("nope");
    expect(spans[0]).toMatchObject({
      severity_text: "ERROR",
      severity_number: 17,
      status: { code: "error", message: "nope" },
    });
  });

  it("starts a new trace when no context is bound", () => {
    const { tracer: t, spans } = tracer();
    t.startActiveSpan("root", {}, () => undefined);
    expect(spans[0]?.trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(spans[0]).not.toHaveProperty("parent_span_id");
  });

  it("writes one record even when end() is called again by hand", () => {
    const { tracer: t, spans } = tracer();
    t.startActiveSpan("twice", {}, (span) => span.end());
    expect(spans).toHaveLength(1);
  });
});
