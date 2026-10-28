import { describe, expect, it } from "vitest";

import type { RequestContext } from "../kernel";
import {
  exceptionAttributes,
  type LogResource,
  REDACTED,
  sanitize,
  toLogRecord,
} from "./log-record";

const resource: LogResource = {
  "service.name": "cloudflare-starter-web",
  "service.version": "v-1",
  "deployment.environment.name": "staging",
};
const now = new Date("2026-10-28T12:00:00.000Z");
const context: RequestContext = {
  traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
  spanId: "00f067aa0ba902b7",
  parentSpanId: null,
  traceFlags: "01",
  source: "http",
  userId: "user-1",
  workspaceId: null,
  ip: "203.0.113.7",
  release: "v-1",
  environment: "staging",
};

describe("toLogRecord (OpenTelemetry Logs Data Model)", () => {
  it("builds timestamp, severity, body, trace ids, attributes and resource", () => {
    expect(
      toLogRecord({
        level: "warn",
        event: "files.uploaded",
        fields: { "app.file.size_bytes": 1200, "url.path": "/api/files" },
        bound: { "url.path": "/bound", "http.request.method": "POST" },
        context,
        resource,
        now,
      })
    ).toEqual({
      timestamp: "2026-10-28T12:00:00.000Z",
      severity_text: "WARN",
      severity_number: 13,
      body: "files.uploaded",
      trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
      span_id: "00f067aa0ba902b7",
      trace_flags: "01",
      attributes: {
        "app.request.source": "http",
        "user.id": "user-1",
        "url.path": "/api/files",
        "http.request.method": "POST",
        "app.file.size_bytes": 1200,
      },
      resource,
    });
  });

  it("maps the levels to OpenTelemetry severity numbers and leaves out trace ids without a context", () => {
    const severities = (["debug", "info", "warn", "error"] as const).map(
      (level) => {
        const record = toLogRecord({ level, event: "e", resource, now });
        expect(record).not.toHaveProperty("trace_id");
        return [record.severity_text, record.severity_number];
      }
    );
    expect(severities).toEqual([
      ["DEBUG", 5],
      ["INFO", 9],
      ["WARN", 13],
      ["ERROR", 17],
    ]);
  });

  it("turns an Error under `error` into exception.* attributes", () => {
    const cause = new Error("disk full");
    const error = Object.assign(new TypeError("write failed", { cause }), {
      code: "E_WRITE",
      token: "secret",
    });
    const { attributes } = toLogRecord({
      level: "error",
      event: "error.captured",
      fields: { error },
      resource,
      now,
    });
    expect(attributes).toMatchObject({
      "exception.type": "TypeError",
      "exception.message": "write failed",
      "exception.stacktrace": expect.stringContaining("write failed"),
      "app.exception.fields": { code: "E_WRITE", token: REDACTED },
      "app.exception.cause": { name: "Error", message: "disk full" },
    });
    expect(attributes).not.toHaveProperty("error");
  });

  it("redacts secret-looking keys at any depth and leaves the rest", () => {
    const { attributes } = toLogRecord({
      level: "info",
      event: "auth.request",
      fields: {
        password: "hunter2",
        newPassword: "x",
        BETTER_AUTH_SECRET: "s",
        accessToken: "t",
        "http.request.header.authorization": "Bearer t",
        request: { headers: { Cookie: "a=b" }, path: "/api/files" },
        list: [{ apiKey: "k1" }],
        passwordLength: 12,
      },
      resource,
      now,
    });
    expect(attributes).toEqual({
      password: REDACTED,
      newPassword: REDACTED,
      BETTER_AUTH_SECRET: REDACTED,
      accessToken: REDACTED,
      "http.request.header.authorization": REDACTED,
      request: { headers: { Cookie: REDACTED }, path: "/api/files" },
      list: [{ apiKey: REDACTED }],
      passwordLength: 12,
    });
  });

  it("keeps the record when the fields object itself cannot be read", () => {
    const fields = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("no keys");
        },
      }
    );
    expect(
      toLogRecord({ level: "error", event: "odd", fields, resource, now })
        .attributes
    ).toEqual({ "app.log.attributes": "[unserializable]" });
  });
});

describe("exceptionAttributes", () => {
  it("describes values that are not Errors", () => {
    expect(exceptionAttributes("boom")).toEqual({
      "exception.type": "string",
      "exception.message": "boom",
    });
    expect(exceptionAttributes(null)).toEqual({
      "exception.type": "null",
      "exception.message": "null",
    });
    expect(exceptionAttributes({ code: 1 })).toEqual({
      "exception.type": "object",
      "exception.message": '{"code":1}',
    });
  });
});

describe("sanitize", () => {
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
        nested: new Error("inner"),
        deep,
      })
    ).toMatchObject({
      big: "12",
      nan: "NaN",
      when: "2026-10-28T12:00:00.000Z",
      url: "https://example.test/a?b=1",
      bytes: "[binary 4 bytes]",
      fn: "[function]",
      map: { k: 1 },
      set: [1, 2],
      nested: { name: "Error", message: "inner" },
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
