import { describe, expect, it } from "vitest";

import { createRequestContext, requestContextFields } from "./request-context";

const ids = { uuid: () => "00000000-0000-4000-8000-000000000001" };

describe("createRequestContext", () => {
  it("generates the request id and keeps the IP of an HTTP request", () => {
    expect(
      createRequestContext(
        { ids },
        {
          source: "http",
          release: "v-123",
          environment: "staging",
          ip: "203.0.113.7",
        }
      )
    ).toEqual({
      requestId: "00000000-0000-4000-8000-000000000001",
      source: "http",
      userId: null,
      workspaceId: null,
      ip: "203.0.113.7",
      release: "v-123",
      environment: "staging",
    });
  });

  it("reuses the request id a queue message carries and drops any IP", () => {
    expect(
      createRequestContext(
        { ids },
        {
          source: "queue",
          release: "local",
          environment: "local",
          requestId: "req-from-producer",
          userId: "user-1",
          ip: "203.0.113.7",
        }
      )
    ).toMatchObject({
      requestId: "req-from-producer",
      source: "queue",
      userId: "user-1",
      ip: null,
    });
  });

  it("generates an id when the message carries none", () => {
    expect(
      createRequestContext(
        { ids },
        {
          source: "cron",
          release: "local",
          environment: "local",
          requestId: "",
        }
      ).requestId
    ).toBe("00000000-0000-4000-8000-000000000001");
  });
});

describe("requestContextFields", () => {
  it("lists the fields logs carry, without the IP", () => {
    const context = createRequestContext(
      { ids },
      { source: "http", release: "r", environment: "e", ip: "203.0.113.7" }
    );
    expect(requestContextFields(context)).toEqual({
      requestId: "00000000-0000-4000-8000-000000000001",
      source: "http",
      userId: null,
      workspaceId: null,
      release: "r",
      environment: "e",
    });
  });
});
