import { describe, expect, it } from "vitest";

import {
  METRIC_CATALOG,
  type MetricDefinition,
  toOpenMetricsLabel,
  toOpenMetricsName,
  validateMetricDefinition,
} from "./metric-catalog";

const valid: MetricDefinition = {
  kind: "histogram",
  unit: "s",
  description: "Something that takes time.",
  attributes: ["http.request.method"],
  buckets: [0.1, 1],
};

describe("metric catalog", () => {
  it.each(Object.entries(METRIC_CATALOG))(
    "%s is a valid entry (name, unit, attributes, buckets)",
    (name, definition) => {
      expect(validateMetricDefinition(name, definition)).toEqual([]);
    }
  );

  it("uses the OpenTelemetry semantic-convention names and units where one exists", () => {
    expect(METRIC_CATALOG["http.server.request.duration"]).toMatchObject({
      kind: "histogram",
      unit: "s",
    });
    expect(METRIC_CATALOG["rpc.server.call.duration"].unit).toBe("s");
    expect(METRIC_CATALOG["messaging.process.duration"].unit).toBe("s");
    expect(METRIC_CATALOG["messaging.client.consumed.messages"]).toMatchObject({
      kind: "counter",
      unit: "{message}",
    });
  });

  it("rejects names that are not dotted lowercase OTel names", () => {
    for (const name of ["HttpDuration", "http", "http.Server", "http-server.x"])
      expect(validateMetricDefinition(name, valid)).toContainEqual(
        expect.stringContaining("not a dotted lowercase OTel name")
      );
  });

  it("rejects units outside UCUM's list and a ratio on anything but an upDownCounter", () => {
    expect(
      validateMetricDefinition("app.x.duration", {
        ...valid,
        unit: "ms" as never,
      })
    ).toContainEqual(expect.stringContaining('unit "ms"'));
    expect(
      validateMetricDefinition("app.x.usage", {
        kind: "counter",
        unit: "1",
        description: "x",
        attributes: [],
      })
    ).toContainEqual(expect.stringContaining("ratio"));
  });

  it("rejects high-cardinality attributes: ids, users, workspaces, raw paths", () => {
    for (const key of [
      "user.id",
      "app.workspace.id",
      "app.file.id",
      "url.path",
      "url.full",
      "client.address",
      "session.id",
    ]) {
      expect(
        validateMetricDefinition("app.x.duration", {
          ...valid,
          attributes: [key],
        })
      ).toContainEqual(
        expect.stringContaining("identifies a person or record")
      );
    }
    expect(
      validateMetricDefinition("app.x.duration", {
        ...valid,
        attributes: ["http.route", "rpc.system.name", "error.type"],
      })
    ).toEqual([]);
  });

  it("rejects histograms without ascending buckets, buckets on counters and _total names", () => {
    expect(
      validateMetricDefinition("app.x.duration", { ...valid, buckets: [] })
    ).toContainEqual("histogram without buckets");
    expect(
      validateMetricDefinition("app.x.duration", { ...valid, buckets: [1, 1] })
    ).toContainEqual("bucket boundaries are not strictly ascending");
    expect(
      validateMetricDefinition("app.x.duration", {
        ...valid,
        buckets: Array.from({ length: 16 }, (_, i) => i + 1),
      })
    ).toContainEqual("more than 15 bucket boundaries");
    expect(
      validateMetricDefinition("app.x_total", {
        kind: "counter",
        unit: "{call}",
        description: "x",
        attributes: [],
        buckets: [1],
      })
    ).toEqual([
      "only histograms have buckets",
      "do not end a name in _total: the exporter adds it",
    ]);
  });

  it("rejects more attributes than the Analytics Engine layout has blobs for", () => {
    expect(
      validateMetricDefinition("app.x.duration", {
        ...valid,
        attributes: Array.from({ length: 16 }, (_, i) => `app.k${i}.kind`),
      })
    ).toContainEqual("more than 15 attributes");
  });

  it("maps names to OpenMetrics: underscores, base unit suffix, _total for counters", () => {
    expect(toOpenMetricsName("http.server.request.duration")).toBe(
      "http_server_request_duration_seconds"
    );
    expect(toOpenMetricsName("rpc.server.call.duration")).toBe(
      "rpc_server_call_duration_seconds"
    );
    expect(toOpenMetricsName("messaging.client.consumed.messages")).toBe(
      "messaging_client_consumed_messages_total"
    );
    expect(toOpenMetricsName("app.cron.run.duration")).toBe(
      "app_cron_run_duration_seconds"
    );
    expect(toOpenMetricsLabel("http.response.status_code")).toBe(
      "http_response_status_code"
    );
    expect(() => toOpenMetricsName("not.in.catalog")).toThrow(
      "Unknown metric not.in.catalog"
    );
  });
});
