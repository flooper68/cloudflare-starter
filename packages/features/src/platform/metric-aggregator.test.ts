import { describe, expect, it } from "vitest";

import {
  bucketIndex,
  createMetricAggregator,
  MAX_PENDING_SERIES,
} from "./metric-aggregator";
import { DURATION_BUCKETS_SECONDS } from "./metric-catalog";

describe("metric aggregator", () => {
  it("puts a value in the first bucket whose bound it does not exceed (bounds inclusive)", () => {
    expect(bucketIndex(DURATION_BUCKETS_SECONDS, 0)).toBe(0);
    expect(bucketIndex(DURATION_BUCKETS_SECONDS, 0.005)).toBe(0);
    expect(bucketIndex(DURATION_BUCKETS_SECONDS, 0.0051)).toBe(1);
    expect(bucketIndex(DURATION_BUCKETS_SECONDS, 10)).toBe(13);
    expect(bucketIndex(DURATION_BUCKETS_SECONDS, 10.1)).toBe(14);
  });

  it("aggregates a histogram into sum, count, min, max and bucket counts per attribute set", () => {
    const aggregator = createMetricAggregator();
    const attributes = { "app.cron.schedule": "*/5 * * * *" };
    for (const value of [0.02, 0.3, 0.3, 4])
      aggregator.record(
        "app.cron.run.duration",
        "histogram",
        value,
        attributes
      );
    const [series] = aggregator.drain(10);
    expect(series).toMatchObject({
      name: "app.cron.run.duration",
      kind: "histogram",
      unit: "s",
      attributes,
      count: 4,
      min: 0.02,
      max: 4,
      boundaries: DURATION_BUCKETS_SECONDS,
    });
    expect(series?.sum).toBeCloseTo(4.62, 10);
    expect(series?.bucketCounts).toEqual([
      0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0,
    ]);
    expect(aggregator.pending).toBe(0);
  });

  it("keeps one series per distinct attribute values, whatever the key order", () => {
    const aggregator = createMetricAggregator();
    aggregator.record("rpc.server.call.duration", "histogram", 1, {
      "rpc.method": "a",
      "rpc.system.name": "trpc",
    });
    aggregator.record("rpc.server.call.duration", "histogram", 1, {
      "rpc.system.name": "trpc",
      "rpc.method": "a",
    });
    aggregator.record("rpc.server.call.duration", "histogram", 1, {
      "rpc.system.name": "trpc",
      "rpc.method": "b",
    });
    expect(aggregator.drain(10).map((series) => series.count)).toEqual([2, 1]);
  });

  it("ignores unknown metrics, the wrong kind, non-finite values and negative counter increments", () => {
    const aggregator = createMetricAggregator();
    aggregator.record("not.in.catalog", "histogram", 1);
    aggregator.record("app.cron.run.duration", "counter", 1);
    aggregator.record("app.cron.run.duration", "histogram", Number.NaN);
    aggregator.record("messaging.client.consumed.messages", "counter", -1);
    expect(aggregator.pending).toBe(0);
  });

  it("keeps only catalog attribute keys with primitive values, in catalog order", () => {
    const aggregator = createMetricAggregator();
    aggregator.record("app.cron.run.duration", "histogram", 1, {
      "user.id": "user-1",
      "error.type": "TypeError",
      "app.cron.schedule": { nested: true },
    });
    expect(aggregator.drain(1)[0]?.attributes).toEqual({
      "error.type": "TypeError",
    });
  });

  it("drains at most `limit` series and keeps the rest for the next drain", () => {
    const aggregator = createMetricAggregator();
    for (const schedule of ["a", "b", "c"])
      aggregator.record("app.cron.run.duration", "histogram", 1, {
        "app.cron.schedule": schedule,
      });
    expect(aggregator.drain(2)).toHaveLength(2);
    expect(aggregator.pending).toBe(1);
    expect(aggregator.drain(2)[0]?.attributes).toEqual({
      "app.cron.schedule": "c",
    });
  });

  it("drops measurements of new series beyond MAX_PENDING_SERIES and counts them", () => {
    const aggregator = createMetricAggregator();
    for (let i = 0; i <= MAX_PENDING_SERIES; i += 1)
      aggregator.record("app.cron.run.duration", "histogram", 1, {
        "app.cron.schedule": String(i),
      });
    expect(aggregator.pending).toBe(MAX_PENDING_SERIES);
    expect(aggregator.dropped).toBe(1);
    // An existing series still aggregates.
    aggregator.record("app.cron.run.duration", "histogram", 1, {
      "app.cron.schedule": "0",
    });
    expect(aggregator.dropped).toBe(1);
  });
});
