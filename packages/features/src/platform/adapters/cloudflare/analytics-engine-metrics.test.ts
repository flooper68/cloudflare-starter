// The documented data-point layout, as pure functions (Node). The adapter itself runs its
// contract in workerd: analytics-engine-metrics.contract.integration.test.ts.
import { describe, expect, it } from "vitest";

import type { MetricSeries } from "../../metric-aggregator";
import {
  ANALYTICS_ENGINE_LAYOUT,
  fromDataPoint,
  toDataPoint,
} from "./analytics-engine-metrics";

const resource = {
  "service.name": "cloudflare-starter-web",
  "service.version": "9034879f",
  "deployment.environment.name": "production",
} as const;

const series: MetricSeries = {
  name: "http.server.request.duration",
  kind: "histogram",
  unit: "s",
  attributes: {
    "http.request.method": "GET",
    "http.route": "/api/files/[id]",
    "http.response.status_code": 200,
    "url.scheme": "https",
  },
  sum: 0.42,
  count: 3,
  min: 0.04,
  max: 0.3,
  boundaries: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5],
  bucketCounts: [0, 0, 0, 1, 0, 1, 0, 1, 0],
};

describe("Analytics Engine data-point layout", () => {
  it("writes the name as index1, attributes in catalog order, then kind, unit and resource", () => {
    const point = toDataPoint(series, resource);
    expect(point.indexes).toEqual(["http.server.request.duration"]);
    expect(point.blobs).toHaveLength(20);
    expect(point.blobs?.slice(0, 6)).toEqual([
      "GET",
      "/api/files/[id]",
      "200",
      "https",
      "", // error.type absent
      "",
    ]);
    const { blob } = ANALYTICS_ENGINE_LAYOUT;
    expect(point.blobs?.[blob.kind - 1]).toBe("histogram");
    expect(point.blobs?.[blob.unit - 1]).toBe("s");
    expect(point.blobs?.[blob.serviceName - 1]).toBe("cloudflare-starter-web");
    expect(point.blobs?.[blob.environment - 1]).toBe("production");
    expect(point.blobs?.[blob.serviceVersion - 1]).toBe("9034879f");
  });

  it("writes sum, count, min, max, then the bucket counts as doubles (at most 20)", () => {
    const point = toDataPoint(series, resource);
    expect(point.doubles).toEqual([
      0.42, 3, 0.04, 0.3, 0, 0, 0, 1, 0, 1, 0, 1, 0,
    ]);
    expect(point.doubles?.length).toBeLessThanOrEqual(20);
  });

  it("keeps the index under 96 bytes and cuts long attribute values", () => {
    const point = toDataPoint(
      {
        ...series,
        attributes: { ...series.attributes, "http.route": "x".repeat(1000) },
      },
      resource
    );
    expect(point.blobs?.[1]).toHaveLength(256);
  });

  it("reads a data point back into the series it was written from", () => {
    const decoded = fromDataPoint(toDataPoint(series, resource));
    expect(decoded).toMatchObject({
      name: series.name,
      kind: "histogram",
      unit: "s",
      sum: 0.42,
      count: 3,
      min: 0.04,
      max: 0.3,
      attributes: {
        "http.request.method": "GET",
        "http.route": "/api/files/[id]",
        "http.response.status_code": "200",
        "url.scheme": "https",
      },
      resource,
    });
    expect(decoded.attributes).not.toHaveProperty("error.type");
  });
});
