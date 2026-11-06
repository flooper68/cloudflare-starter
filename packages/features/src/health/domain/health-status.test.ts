import { describe, expect, it } from "vitest";

import {
  aggregateHealthStatus,
  healthHttpStatus,
  latencyStatus,
} from "./health-status";

describe("aggregateHealthStatus", () => {
  it("passes when every check passes, or there are none", () => {
    expect(aggregateHealthStatus(["pass", "pass"])).toBe("pass");
    expect(aggregateHealthStatus([])).toBe("pass");
  });

  it("warns when a check warns and none failed", () => {
    expect(aggregateHealthStatus(["pass", "warn", "pass"])).toBe("warn");
  });

  it("fails when any check fails, whatever the others say", () => {
    expect(aggregateHealthStatus(["warn", "fail", "pass"])).toBe("fail");
    expect(aggregateHealthStatus(["fail"])).toBe("fail");
  });
});

describe("healthHttpStatus", () => {
  it("answers 200 for pass and warn, 503 for fail", () => {
    expect(healthHttpStatus("pass")).toBe(200);
    expect(healthHttpStatus("warn")).toBe(200);
    expect(healthHttpStatus("fail")).toBe(503);
  });
});

describe("latencyStatus", () => {
  it("warns only above the threshold", () => {
    expect(latencyStatus(1000, 1000)).toBe("pass");
    expect(latencyStatus(1001, 1000)).toBe("warn");
  });

  it("never warns without a threshold", () => {
    expect(latencyStatus(60_000, undefined)).toBe("pass");
  });
});
