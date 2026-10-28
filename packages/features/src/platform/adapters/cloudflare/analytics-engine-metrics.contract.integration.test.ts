// Runs in workerd (features-integration): the adapter writes to the simulated Analytics
// Engine dataset binding METRICS_DATASET (test/wrangler.jsonc); the spy passes every call
// through and decodes the data points it saw with the documented layout.
import { env } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import { describeMetricsContract } from "../../ports/metrics.contract";
import {
  createAnalyticsEngineMetrics,
  fromDataPoint,
  MAX_POINTS_PER_FLUSH,
} from "./analytics-engine-metrics";

const resource = {
  "service.name": "cloudflare-starter-web",
  "service.version": "local",
  "deployment.environment.name": "test",
} as const;

function spyOnDataset() {
  return vi.spyOn(env.METRICS_DATASET, "writeDataPoint");
}

describeMetricsContract("createAnalyticsEngineMetrics", () => {
  const spy = spyOnDataset();
  return {
    metrics: createAnalyticsEngineMetrics({
      dataset: env.METRICS_DATASET,
      resource,
    }),
    exported: () => spy.mock.calls.map(([point]) => fromDataPoint(point ?? {})),
    dispose: () => spy.mockRestore(),
  };
});

describe("createAnalyticsEngineMetrics against the local binding", () => {
  it("writes one data point per series with the resource blobs, at most MAX_POINTS_PER_FLUSH per flush", () => {
    const spy = spyOnDataset();
    const metrics = createAnalyticsEngineMetrics({
      dataset: env.METRICS_DATASET,
      resource,
    });
    const runs = metrics.histogram("app.cron.run.duration");
    for (let i = 0; i < MAX_POINTS_PER_FLUSH + 5; i += 1) {
      runs.record(0.5, { "app.cron.schedule": `schedule-${i}` });
    }
    metrics.flush();
    expect(spy).toHaveBeenCalledTimes(MAX_POINTS_PER_FLUSH);
    const first = spy.mock.calls[0]?.[0];
    expect(first?.indexes).toEqual(["app.cron.run.duration"]);
    expect(first?.blobs?.slice(15)).toEqual([
      "histogram",
      "s",
      "cloudflare-starter-web",
      "test",
      "local",
    ]);
    // The rest waits, aggregated, for the next flush.
    metrics.flush();
    expect(spy).toHaveBeenCalledTimes(MAX_POINTS_PER_FLUSH + 5);
    spy.mockRestore();
  });
});
