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

  it("carries the producer's W3C traceparent when there is one", () => {
    const base = {
      type: "hello",
      name: "Nicole",
      userId: "user-1",
      queuedAt: "2026-04-19T18:00:00.000Z",
    };
    const traceparent =
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    expect(helloMessageSchema.parse({ ...base, traceparent }).traceparent).toBe(
      traceparent
    );
    expect(helloMessageSchema.parse(base).traceparent).toBeUndefined();
    for (const bad of ["", "req-1", traceparent.toUpperCase()]) {
      expect(() =>
        helloMessageSchema.parse({ ...base, traceparent: bad })
      ).toThrow();
    }
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
