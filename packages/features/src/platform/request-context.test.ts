import { describe, expect, it } from "vitest";

import {
  createRequestContext,
  requestContextAttributes,
} from "./request-context";

function counting() {
  let next = 0;
  return {
    uuid: () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
  };
}

describe("createRequestContext", () => {
  it("starts a new trace and keeps the IP of an HTTP request", () => {
    expect(
      createRequestContext(
        { ids: counting() },
        {
          source: "http",
          release: "v-123",
          environment: "staging",
          ip: "203.0.113.7",
        }
      )
    ).toEqual({
      traceId: "00000000000040008000000000000001",
      spanId: "8000000000000002",
      parentSpanId: null,
      traceFlags: "01",
      source: "http",
      userId: null,
      workspaceId: null,
      ip: "203.0.113.7",
      release: "v-123",
      environment: "staging",
    });
  });

  it("continues a valid incoming traceparent with its own span", () => {
    const context = createRequestContext(
      { ids: counting() },
      {
        source: "queue",
        release: "local",
        environment: "local",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
        userId: "user-1",
        ip: "203.0.113.7",
      }
    );
    expect(context).toMatchObject({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentSpanId: "00f067aa0ba902b7",
      traceFlags: "00",
      source: "queue",
      userId: "user-1",
      ip: null,
    });
    expect(context.spanId).not.toBe("00f067aa0ba902b7");
  });

  it("propagates only the sampled bit of incoming trace flags", () => {
    const context = createRequestContext(
      { ids: counting() },
      {
        source: "http",
        release: "local",
        environment: "local",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-ff",
      }
    );
    expect(context.traceFlags).toBe("01");
  });

  it("starts a new trace when the traceparent is invalid", () => {
    const context = createRequestContext(
      { ids: counting() },
      {
        source: "http",
        release: "local",
        environment: "local",
        traceparent: "00-not-a-trace-01",
      }
    );
    expect(context.traceId).toBe("00000000000040008000000000000001");
    expect(context.parentSpanId).toBeNull();
  });
});

describe("requestContextAttributes", () => {
  it("maps the context to semantic-convention and app.* attributes, never the IP", () => {
    const context = createRequestContext(
      { ids: counting() },
      {
        source: "http",
        release: "r",
        environment: "e",
        ip: "203.0.113.7",
        userId: "user-1",
        workspaceId: "ws-1",
      }
    );
    expect(requestContextAttributes(context)).toEqual({
      "app.request.source": "http",
      "user.id": "user-1",
      "app.workspace.id": "ws-1",
    });
  });

  it("leaves absent values out", () => {
    const context = createRequestContext(
      { ids: counting() },
      { source: "cron", release: "r", environment: "e" }
    );
    expect(requestContextAttributes(context)).toEqual({
      "app.request.source": "cron",
    });
  });
});
