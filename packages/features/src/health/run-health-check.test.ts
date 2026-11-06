import { describe, expect, it } from "vitest";

import type { Clock } from "../kernel";
import { type HealthProbe, runHealthCheck } from "./run-health-check";

/** A clock that moves forward `stepMs` on every read. */
function steppingClock(stepMs: number): Clock {
  let now = Date.parse("2026-11-06T10:00:00.000Z");
  return {
    now: () => {
      const value = new Date(now);
      now += stepMs;
      return value;
    },
  };
}

const probe = (overrides: Partial<HealthProbe> = {}): HealthProbe => ({
  name: "d1:responseTime",
  componentType: "datastore",
  run: async () => undefined,
  measured: true,
  warnAboveMs: 1000,
  ...overrides,
});

const deps = (stepMs = 5, timeoutMs = 1000) => ({
  clock: steppingClock(stepMs),
  timeoutMs,
});

describe("runHealthCheck", () => {
  it("passes with the latency when the probe resolves", async () => {
    expect(await runHealthCheck(deps(5), probe())).toEqual({
      name: "d1:responseTime",
      componentType: "datastore",
      status: "pass",
      time: new Date("2026-11-06T10:00:00.005Z"),
      observedValue: 5,
      observedUnit: "ms",
    });
  });

  it("warns when a measured probe is slower than its threshold", async () => {
    const result = await runHealthCheck(deps(1500, 60_000), probe());
    expect(result).toMatchObject({
      status: "warn",
      output: "slow",
      observedValue: 1500,
    });
  });

  it("fails with a fixed output and the message as detail when the probe throws", async () => {
    const result = await runHealthCheck(
      deps(),
      probe({
        run: async () => {
          throw new Error("D1_ERROR: network connection lost");
        },
      })
    );
    expect(result).toMatchObject({
      status: "fail",
      output: "error",
      detail: "Error: D1_ERROR: network connection lost",
    });
  });

  it("fails a synchronous throw the same way", async () => {
    const result = await runHealthCheck(
      deps(),
      probe({
        run: () => {
          throw new TypeError("not a function");
        },
      })
    );
    expect(result).toMatchObject({ status: "fail", output: "error" });
  });

  it("fails with output timeout when the probe never settles", async () => {
    const result = await runHealthCheck(
      deps(5, 20),
      probe({ run: () => new Promise(() => {}) })
    );
    expect(result).toMatchObject({
      status: "fail",
      output: "timeout",
      detail: "no answer within 20 ms",
    });
  });

  it("keeps a configuration probe's own outcome and reports no latency", async () => {
    const result = await runHealthCheck(
      deps(),
      probe({
        name: "email:configuration",
        componentType: "component",
        measured: false,
        run: () => ({ status: "warn", output: "not configured", detail: "x" }),
      })
    );
    expect(result).toEqual({
      name: "email:configuration",
      componentType: "component",
      status: "warn",
      time: expect.any(Date),
      output: "not configured",
      detail: "x",
    });
  });
});
