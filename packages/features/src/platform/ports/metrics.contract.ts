/**
 * The Metrics contract: every adapter's `*.contract.test.ts` runs this suite against it.
 * Test support only (not exported from the barrel, not bundled).
 */
import { afterEach, describe, expect, it } from "vitest";

import type { Metrics } from "./metrics";

/**
 * One series as the backend received it after `flush()`, decoded into the OpenTelemetry
 * shape: name, attributes, sum, count and (histograms) the count per bucket.
 */
export interface ObservedSeries {
  readonly name: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly sum: number;
  readonly count: number;
  readonly bucketCounts?: readonly number[];
}

export interface MetricsHarness {
  readonly metrics: Metrics;
  /** What the adapter exported so far. Omit for adapters that discard everything (noop). */
  readonly exported?: () => readonly ObservedSeries[];
  readonly dispose?: () => void;
}

const ROUTE = {
  "http.request.method": "GET",
  "http.route": "/api/hello",
  "http.response.status_code": 200,
  "url.scheme": "https",
} as const;

export function describeMetricsContract(
  name: string,
  makeHarness: () => MetricsHarness
): void {
  describe(`${name} satisfies the Metrics contract`, () => {
    const made: MetricsHarness[] = [];
    const harness = () => {
      const created = makeHarness();
      made.push(created);
      return created;
    };
    afterEach(() => {
      for (const created of made.splice(0)) created.dispose?.();
    });

    it("records every instrument kind and flushes without throwing", () => {
      const { metrics } = harness();
      expect(() => {
        metrics.histogram("http.server.request.duration").record(0.12, ROUTE);
        metrics
          .counter("messaging.client.consumed.messages")
          .add(1, { "messaging.system": "cloudflare_queues" });
        metrics.flush();
        metrics.flush();
      }).not.toThrow();
    });

    it("never throws on invalid values or attributes", () => {
      const { metrics } = harness();
      const histogram = metrics.histogram("http.server.request.duration");
      const counter = metrics.counter("messaging.client.consumed.messages");
      expect(() => {
        histogram.record(Number.NaN);
        histogram.record(Number.POSITIVE_INFINITY);
        counter.add(-1);
        histogram.record(0.1, {
          "user.id": "user-1",
          nested: { deep: true },
        } as never);
        (metrics.histogram as (name: string) => typeof histogram)(
          "not.in.catalog"
        ).record(1);
        metrics.flush();
      }).not.toThrow();
    });

    const observable = makeHarness();
    observable.dispose?.();
    if (!observable.exported) return;

    it("aggregates a histogram per attribute set: sum, count and buckets", () => {
      const { metrics, exported } = harness();
      const duration = metrics.histogram("http.server.request.duration");
      duration.record(0.003, ROUTE);
      duration.record(0.2, ROUTE);
      duration.record(12, ROUTE);
      duration.record(0.04, { ...ROUTE, "http.response.status_code": 404 });
      metrics.flush();

      const all = exported?.() ?? [];
      expect(all).toHaveLength(2);
      const ok = all.find(
        // Backends may store attribute values as strings (Analytics Engine blobs).
        (series) =>
          String(series.attributes["http.response.status_code"]) === "200"
      );
      expect(ok).toMatchObject({
        name: "http.server.request.duration",
        count: 3,
        attributes: {
          "http.request.method": "GET",
          "http.route": "/api/hello",
          "url.scheme": "https",
        },
      });
      expect(ok?.sum).toBeCloseTo(12.203, 6);
      // Buckets: 0.003 ≤ 0.005, 0.2 ≤ 0.25, 12 above the last bound (10).
      expect(ok?.bucketCounts).toEqual([
        1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1,
      ]);
    });

    it("sums counter increments and ignores negative and non-finite ones", () => {
      const { metrics, exported } = harness();
      const consumed = metrics.counter("messaging.client.consumed.messages");
      const attributes = {
        "messaging.system": "cloudflare_queues",
        "messaging.operation.name": "process",
      } as const;
      consumed.add(1, attributes);
      consumed.add(2, attributes);
      consumed.add(-5, attributes);
      consumed.add(Number.NaN, attributes);
      metrics.flush();
      expect(exported?.()).toEqual([
        expect.objectContaining({
          name: "messaging.client.consumed.messages",
          sum: 3,
          count: 2,
        }),
      ]);
    });

    it("drops attribute keys the catalog does not list (no ids on metrics)", () => {
      const { metrics, exported } = harness();
      metrics.histogram("app.cron.run.duration").record(1, {
        "app.cron.schedule": "*/5 * * * *",
        "user.id": "user-1",
        "app.workspace.id": "ws-1",
      } as never);
      metrics.flush();
      const [series] = exported?.() ?? [];
      expect(series?.attributes).toMatchObject({
        "app.cron.schedule": "*/5 * * * *",
      });
      expect(JSON.stringify(exported?.())).not.toMatch(/user-1|ws-1/);
    });

    it("exports each measurement once: a second flush sends only what is new", () => {
      const { metrics, exported } = harness();
      const runs = metrics.histogram("app.cron.run.duration");
      runs.record(1, { "app.cron.schedule": "0 * * * *" });
      metrics.flush();
      metrics.flush();
      runs.record(2, { "app.cron.schedule": "0 * * * *" });
      metrics.flush();
      expect(exported?.().map((series) => series.sum)).toEqual([1, 2]);
    });
  });
}
