import { describe, expect, it } from "vitest";

import {
  formatTraceparent,
  newSpanId,
  newTraceId,
  parseTraceparent,
} from "./trace-context";

describe("parseTraceparent (W3C Trace Context)", () => {
  it("parses a valid version-00 header", () => {
    expect(
      parseTraceparent(
        "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
      )
    ).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentSpanId: "00f067aa0ba902b7",
      traceFlags: "01",
    });
  });

  it("accepts a later version with extra fields", () => {
    expect(
      parseTraceparent(
        "cc-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00-what-the-future-holds"
      )?.traceId
    ).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });

  it.each([
    null,
    "",
    "garbage",
    "00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01",
    "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
    "00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01",
    "ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01-extra",
    "00-4bf92f3577b34da6a3ce929d0e0e473-00f067aa0ba902b7-01",
    `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01${"0".repeat(600)}`,
  ])("rejects %j", (header) => {
    expect(parseTraceparent(header)).toBeNull();
  });
});

describe("trace and span ids", () => {
  const ids = { uuid: () => "8f14e45f-ceea-467a-9575-0f4c5e9b2c11" };

  it("are lowercase hex of the right length", () => {
    expect(newTraceId(ids)).toBe("8f14e45fceea467a95750f4c5e9b2c11");
    expect(newSpanId(ids)).toBe("95750f4c5e9b2c11");
  });

  it("are never all zeros", () => {
    const zeros = { uuid: () => "00000000-0000-0000-0000-000000000000" };
    expect(newTraceId(zeros)).toBe(`${"0".repeat(31)}1`);
    expect(newSpanId(zeros)).toBe(`${"0".repeat(15)}1`);
  });

  it("format back into a traceparent whose parent is this span", () => {
    const header = formatTraceparent({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "b7ad6b7169203331",
      traceFlags: "01",
    });
    expect(header).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-b7ad6b7169203331-01"
    );
    expect(parseTraceparent(header)?.parentSpanId).toBe("b7ad6b7169203331");
  });
});
