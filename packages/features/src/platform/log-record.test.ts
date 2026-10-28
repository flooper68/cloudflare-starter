import { describe, expect, it } from "vitest";

import { REDACTED, sanitize, toLogRecord } from "./log-record";

describe("toLogRecord", () => {
  it("puts level and event first, then bound fields, then call fields", () => {
    const record = toLogRecord(
      "info",
      "files.uploaded",
      { sizeBytes: 1200, requestId: "call" },
      { requestId: "bound", userId: "user-1" }
    );
    expect(Object.keys(record)).toEqual([
      "level",
      "event",
      "requestId",
      "userId",
      "sizeBytes",
    ]);
    expect(record).toEqual({
      level: "info",
      event: "files.uploaded",
      requestId: "call",
      userId: "user-1",
      sizeBytes: 1200,
    });
  });

  it("does not let fields overwrite level or event", () => {
    expect(
      toLogRecord("warn", "real.event", { level: "debug", event: "fake" })
    ).toEqual({ level: "warn", event: "real.event" });
  });

  it("redacts secret-looking keys at any depth and leaves the rest", () => {
    const record = toLogRecord("info", "auth.request", {
      password: "hunter2",
      newPassword: "x",
      BETTER_AUTH_SECRET: "s",
      R2_SECRET_ACCESS_KEY: "k",
      accessToken: "t",
      request: {
        headers: {
          Authorization: "Bearer t",
          Cookie: "a=b",
          "set-cookie": "c",
        },
        path: "/api/files",
      },
      list: [{ apiKey: "k1" }],
      passwordLength: 12,
    });
    expect(record).toEqual({
      level: "info",
      event: "auth.request",
      password: REDACTED,
      newPassword: REDACTED,
      BETTER_AUTH_SECRET: REDACTED,
      R2_SECRET_ACCESS_KEY: REDACTED,
      accessToken: REDACTED,
      request: {
        headers: {
          Authorization: REDACTED,
          Cookie: REDACTED,
          "set-cookie": REDACTED,
        },
        path: "/api/files",
      },
      list: [{ apiKey: REDACTED }],
      passwordLength: 12,
    });
  });

  it("returns a minimal record when the fields object itself cannot be read", () => {
    const fields = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("no keys");
        },
      }
    );
    expect(toLogRecord("error", "odd", fields)).toEqual({
      level: "error",
      event: "odd",
      fields: "[unserializable]",
    });
  });
});

describe("sanitize", () => {
  it("serializes errors with name, message, stack, own fields and cause", () => {
    const cause = new Error("disk full");
    const error = Object.assign(new TypeError("write failed", { cause }), {
      code: "E_WRITE",
      token: "secret",
    });
    const out = sanitize(error) as Record<string, unknown>;
    expect(out).toMatchObject({
      name: "TypeError",
      message: "write failed",
      code: "E_WRITE",
      token: REDACTED,
      cause: { name: "Error", message: "disk full" },
    });
    expect(out.stack).toContain("write failed");
  });

  it("marks circular references but keeps shared ones", () => {
    const shared = { id: 1 };
    const loop: Record<string, unknown> = { a: shared, b: shared };
    loop.self = loop;
    expect(sanitize(loop)).toEqual({
      a: { id: 1 },
      b: { id: 1 },
      self: "[circular]",
    });
  });

  it("makes non-JSON values JSON-safe", () => {
    const deep = {
      a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } },
    };
    expect(
      sanitize({
        big: 12n,
        nan: Number.NaN,
        when: new Date("2026-10-28T12:00:00.000Z"),
        url: new URL("https://example.test/a?b=1"),
        bytes: new Uint8Array(4),
        fn: () => 1,
        missing: undefined,
        map: new Map([["k", 1]]),
        set: new Set([1, 2]),
        deep,
      })
    ).toEqual({
      big: "12",
      nan: "NaN",
      when: "2026-10-28T12:00:00.000Z",
      url: "https://example.test/a?b=1",
      bytes: "[binary 4 bytes]",
      fn: "[function]",
      map: { k: 1 },
      set: [1, 2],
      deep: {
        a: { b: { c: { d: { e: { f: { g: "[depth limit]" } } } } } },
      },
    });
  });

  it("survives throwing getters and cuts very long strings", () => {
    const throwing = {
      get value(): never {
        throw new Error("nope");
      },
    };
    expect(sanitize({ throwing })).toEqual({ throwing: "[unserializable]" });
    const long = sanitize("x".repeat(9000)) as string;
    expect(long.length).toBeLessThan(8300);
    expect(long).toContain("[truncated 808 chars]");
  });
});
