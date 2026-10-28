import {
  type CronDeps,
  createCronCatalog,
  createMemoryErrorReporter,
  createMemoryJobQueue,
  createMemoryLogger,
  createMemoryMetrics,
  createMemoryTracer,
  cronCatalog,
  noopFeatureFlags,
  noopHumanVerifier,
  noopProductAnalytics,
  noopRateLimiter,
} from "@cloudflare-starter/features";
import { describe, expect, it, vi } from "vitest";

import { runScheduled } from "./cron";
import type { Platform } from "./platform";

function memoryPlatform() {
  const logger = createMemoryLogger();
  const errors = createMemoryErrorReporter();
  const jobQueue = createMemoryJobQueue();
  const metrics = createMemoryMetrics();
  const tracer = createMemoryTracer();
  const platform: Platform = {
    logger,
    errors,
    jobQueue,
    metrics,
    tracer,
    flags: noopFeatureFlags,
    flagStore: null,
    release: "v-test",
    environment: "staging",
    rateLimiter: noopRateLimiter,
    humanVerifier: noopHumanVerifier,
    turnstile: null,
    productAnalytics: () => noopProductAnalytics,
    webAnalytics: null,
  };
  return { platform, logger, errors, jobQueue, metrics, tracer };
}

const controller = (cron: string) => ({
  cron,
  scheduledTime: Date.parse("2026-10-28T03:17:00.000Z"),
});

describe("cron handler", () => {
  it("the daily schedule runs audit.purge-events and jobs.purge-idempotency-keys, each in a new trace", async () => {
    const { platform, logger, jobQueue } = memoryPlatform();
    expect(
      cronCatalog.filter((e) => e.schedule === "17 3 * * *").map((e) => e.name)
    ).toEqual(["audit.purge-events", "jobs.purge-idempotency-keys"]);

    await runScheduled(controller("17 3 * * *"), platform);
    await runScheduled(controller("17 3 * * *"), platform);

    expect(jobQueue.sent.map((sent) => sent.envelope)).toEqual([
      expect.objectContaining({
        type: "audit.purge-events",
        source: "/staging/cron",
        data: { asOf: "2026-10-28T03:17:00.000Z" },
      }),
      expect.objectContaining({
        type: "jobs.purge-idempotency-keys",
        source: "/staging/cron",
        data: {},
      }),
      expect.objectContaining({ type: "audit.purge-events" }),
      expect.objectContaining({ type: "jobs.purge-idempotency-keys" }),
    ]);
    const traces = jobQueue.sent.map(
      (sent) => sent.envelope.traceparent?.split("-")[1]
    );
    expect(new Set(traces).size).toBe(4);
    expect(logger.records[1]).toMatchObject({
      body: "cron.completed",
      trace_id: traces[1],
      attributes: {
        "app.request.source": "cron",
        "app.cron.name": "jobs.purge-idempotency-keys",
        "app.cron.schedule": "17 3 * * *",
        "app.cron.scheduled_time": "2026-10-28T03:17:00.000Z",
      },
    });
  });

  it("runs every entry of the schedule; reports a failing one and fails the run", async () => {
    const { platform, errors } = memoryPlatform();
    const ran = vi.fn().mockResolvedValue(undefined);
    const catalog = createCronCatalog<CronDeps>([
      {
        name: "reports.broken",
        schedule: "0 6 * * 1",
        run: async () => {
          throw new Error("queue unavailable");
        },
      },
      { name: "reports.weekly", schedule: "0 6 * * 1", run: ran },
      { name: "reports.daily", schedule: "0 6 * * *", run: ran },
    ]);

    await expect(
      runScheduled(controller("0 6 * * 1"), platform, catalog)
    ).rejects.toThrow('1 cron entry failed for "0 6 * * 1"');

    expect(ran).toHaveBeenCalledOnce();
    expect(errors.captured).toEqual([
      expect.objectContaining({
        context: expect.objectContaining({ source: "cron" }),
        extra: expect.objectContaining({
          "app.cron.name": "reports.broken",
          "app.cron.schedule": "0 6 * * 1",
        }),
      }),
    ]);
  });

  it("reports a trigger that no entry handles", async () => {
    const { platform, errors, metrics } = memoryPlatform();
    await expect(
      runScheduled(controller("*/5 * * * *"), platform)
    ).rejects.toThrow(/No cron catalog entry/);
    expect(errors.captured).toHaveLength(1);
    expect(metrics.exported).toEqual([
      expect.objectContaining({
        name: "app.cron.run.duration",
        attributes: {
          "app.cron.schedule": "*/5 * * * *",
          "error.type": "missing_catalog_entry",
        },
      }),
    ]);
  });

  it("makes each entry's run a span with the log's trace and span ids, and measures it, flushed per run", async () => {
    const { platform, logger, metrics, tracer } = memoryPlatform();
    await runScheduled(controller("17 3 * * *"), platform);

    expect(tracer.spans.map((span) => span.name)).toEqual([
      "cron audit.purge-events",
      "cron jobs.purge-idempotency-keys",
    ]);
    expect(tracer.spans[0]).toMatchObject({
      kind: "internal",
      trace_id: logger.records[0]?.trace_id,
      span_id: logger.records[0]?.span_id,
      status: { code: "unset" },
      attributes: {
        "app.cron.name": "audit.purge-events",
        "app.cron.schedule": "17 3 * * *",
      },
    });
    expect(metrics.exported).toEqual([
      expect.objectContaining({
        name: "app.cron.run.duration",
        attributes: {
          "app.cron.name": "audit.purge-events",
          "app.cron.schedule": "17 3 * * *",
        },
        count: 1,
      }),
      expect.objectContaining({
        attributes: {
          "app.cron.name": "jobs.purge-idempotency-keys",
          "app.cron.schedule": "17 3 * * *",
        },
      }),
    ]);
  });

  it("records a failing entry as an error span and with its error type", async () => {
    const { platform, metrics, tracer } = memoryPlatform();
    const catalog = createCronCatalog<CronDeps>([
      {
        name: "reports.broken",
        schedule: "0 6 * * 1",
        run: async () => {
          throw new RangeError("queue unavailable");
        },
      },
    ]);
    await expect(
      runScheduled(controller("0 6 * * 1"), platform, catalog)
    ).rejects.toThrow();
    expect(tracer.spans[0]).toMatchObject({
      status: { code: "error", message: "queue unavailable" },
      events: [{ name: "exception" }],
    });
    expect(metrics.exported[0]?.attributes).toEqual({
      "app.cron.name": "reports.broken",
      "app.cron.schedule": "0 6 * * 1",
      "error.type": "RangeError",
    });
  });
});
