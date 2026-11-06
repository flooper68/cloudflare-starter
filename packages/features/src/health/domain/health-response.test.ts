import { describe, expect, it } from "vitest";

import {
  HEALTH_DETAIL_MAX_LENGTH,
  type HealthCheckResult,
  healthResponseBody,
} from "./health-response";

const TIME = new Date("2026-11-06T10:00:00.000Z");

const d1: HealthCheckResult = {
  name: "d1:responseTime",
  componentType: "datastore",
  status: "pass",
  time: TIME,
  observedValue: 4,
  observedUnit: "ms",
};

const queue: HealthCheckResult = {
  name: "queue:binding",
  componentType: "component",
  status: "pass",
  time: TIME,
};

const input = {
  version: "1",
  releaseId: "3f2c1d7e-0000-4000-8000-000000000001",
  serviceId: "cloudflare-starter-web",
  description: "Readiness of cloudflare-starter-web",
  reference: "4bf92f3577b34da6a3ce929d0e0e4736",
};

describe("healthResponseBody", () => {
  it("shapes passing checks in the IETF health check format", () => {
    expect(healthResponseBody({ ...input, results: [d1, queue] })).toEqual({
      status: "pass",
      version: "1",
      releaseId: input.releaseId,
      serviceId: "cloudflare-starter-web",
      description: "Readiness of cloudflare-starter-web",
      checks: {
        "d1:responseTime": [
          {
            componentType: "datastore",
            status: "pass",
            time: "2026-11-06T10:00:00.000Z",
            observedValue: 4,
            observedUnit: "ms",
          },
        ],
        "queue:binding": [
          {
            componentType: "component",
            status: "pass",
            time: "2026-11-06T10:00:00.000Z",
          },
        ],
      },
      reference: input.reference,
    });
  });

  it("fails overall with a summary when one check fails, and keeps the detail out", () => {
    const body = healthResponseBody({
      ...input,
      results: [
        d1,
        {
          ...queue,
          status: "fail",
          output: "missing binding",
          detail: "not bound: APP_QUEUE",
        },
      ],
    });
    expect(body.status).toBe("fail");
    expect(body.output).toBe("1 of 2 checks failed");
    expect(body.checks["queue:binding"]?.[0]).toMatchObject({
      status: "fail",
      output: "missing binding",
    });
    expect(JSON.stringify(body)).not.toContain("APP_QUEUE");
  });

  it("warns overall when a check warns and none failed", () => {
    const body = healthResponseBody({
      ...input,
      results: [{ ...d1, status: "warn", output: "slow" }, queue],
    });
    expect(body.status).toBe("warn");
    expect(body.output).toBe("1 of 2 checks warned");
  });

  it("adds the detail to the output for the admin view, cut to a safe length", () => {
    const body = healthResponseBody(
      {
        ...input,
        results: [
          {
            ...d1,
            status: "fail",
            output: "error",
            detail: `Error: ${"x".repeat(1000)}`,
          },
          { ...queue, detail: "never shown on pass" },
        ],
      },
      { detail: true }
    );
    const output = body.checks["d1:responseTime"]?.[0]?.output ?? "";
    expect(output.startsWith("error: Error: xxx")).toBe(true);
    expect(output.length).toBe(HEALTH_DETAIL_MAX_LENGTH);
    expect(body.checks["queue:binding"]?.[0]).not.toHaveProperty("output");
  });

  it("groups several results of one key under it", () => {
    const body = healthResponseBody({ ...input, results: [d1, d1] });
    expect(body.checks["d1:responseTime"]).toHaveLength(2);
  });
});
