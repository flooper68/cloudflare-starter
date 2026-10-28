import { describe, expect, it } from "vitest";

import { InvalidJobEnvelopeError } from "./errors";
import { parseJobEnvelope } from "./job-envelope";

const envelope = {
  specversion: "1.0",
  id: "6f1c2d3e-0000-4000-8000-000000000001",
  source: "/production/http",
  type: "greetings.hello",
  time: "2026-10-28T12:00:00.000Z",
  datacontenttype: "application/json",
  data: { name: "Nicole" },
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  idempotencykey: "greetings.hello:nicole",
  userid: "user-1",
  workspaceid: "ws-1",
};

describe("parseJobEnvelope", () => {
  it("accepts a CloudEvents 1.0 envelope with our extension attributes", () => {
    expect(parseJobEnvelope(envelope)).toEqual({ ok: true, envelope });
  });

  it("accepts an envelope without the optional extensions, keeping data as is", () => {
    const {
      traceparent: _t,
      idempotencykey: _i,
      userid: _u,
      workspaceid: _w,
      ...core
    } = envelope;
    expect(parseJobEnvelope({ ...core, data: [1, "two"] })).toEqual({
      ok: true,
      envelope: { ...core, data: [1, "two"] },
    });
  });

  it("drops attributes it does not know", () => {
    const parsed = parseJobEnvelope({ ...envelope, subject: "x", extra: 1 });
    expect(parsed.ok && parsed.envelope).not.toHaveProperty("extra");
  });

  it.each([
    ["another spec version", { specversion: "0.3" }],
    ["an empty id", { id: "" }],
    ["a type without a feature prefix", { type: "hello" }],
    ["an upper-case type", { type: "Greetings.Hello" }],
    ["a time that is not RFC 3339", { time: "yesterday" }],
    ["another content type", { datacontenttype: "text/plain" }],
    ["a malformed traceparent", { traceparent: "req-1" }],
    ["an empty user", { userid: "" }],
  ])("rejects %s", (_, override) => {
    const parsed = parseJobEnvelope({ ...envelope, ...override });
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.issues.length).toBeGreaterThan(0);
  });

  it.each([null, "hello", { type: "hello", name: "Nicole" }])(
    "rejects %j, which is not an envelope at all",
    (body) => {
      expect(parseJobEnvelope(body).ok).toBe(false);
    }
  );

  it("names the issues in a permanent InvalidJobEnvelopeError", () => {
    const parsed = parseJobEnvelope({});
    const error = new InvalidJobEnvelopeError(!parsed.ok && parsed.issues);
    expect(error.kind).toBe("invalid_input");
    expect(error.issues).toEqual(expect.arrayContaining([expect.anything()]));
  });
});
