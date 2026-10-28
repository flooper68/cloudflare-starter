import { describe, expect, it } from "vitest";

import { helloMessageSchema } from "./hello-message";

describe("helloMessageSchema", () => {
  it("accepts a hello message", () => {
    expect(
      helloMessageSchema.parse({
        type: "hello",
        name: "Nicole",
        userId: "user-1",
        queuedAt: "2026-04-19T18:00:00.000Z",
      })
    ).toMatchObject({ type: "hello", name: "Nicole" });
  });

  it("carries the request id of the producer when there is one", () => {
    const base = {
      type: "hello",
      name: "Nicole",
      userId: "user-1",
      queuedAt: "2026-04-19T18:00:00.000Z",
    };
    expect(
      helloMessageSchema.parse({ ...base, requestId: "req-1" }).requestId
    ).toBe("req-1");
    expect(helloMessageSchema.parse(base).requestId).toBeUndefined();
    expect(() =>
      helloMessageSchema.parse({ ...base, requestId: "" })
    ).toThrow();
  });

  it("rejects an empty name and a malformed time", () => {
    expect(() =>
      helloMessageSchema.parse({
        type: "hello",
        name: "",
        userId: "u",
        queuedAt: "bad",
      })
    ).toThrow();
  });
});
