import { describe, expect, it } from "vitest";

import {
  AnalyticsReadError,
  createMemoryAnalyticsReader,
  createMemoryLogger,
} from "../platform";
import { getAnalyticsReport } from "./get-analytics-report";

const clock = { now: () => new Date("2026-11-09T12:00:00.000Z") };
const settings = {
  accountId: "0123456789abcdef0123456789abcdef",
  eventsDataset: "cloudflare_starter_production_product_events",
  metricsDataset: "cloudflare_starter_production_metrics",
  webAnalyticsSiteTag: null,
};

describe("getAnalyticsReport", () => {
  it("names the missing settings instead of reading", async () => {
    expect(
      await getAnalyticsReport(
        { clock },
        { ...settings, reader: null, eventsDataset: null },
        { days: 7 }
      )
    ).toEqual({
      status: "not_configured",
      missing: [
        "ANALYTICS_READ_TOKEN",
        "ANALYTICS_ACCOUNT_ID",
        "ANALYTICS_EVENTS_DATASET",
      ],
    });
  });

  it("runs the site, people and routes queries and builds the report", async () => {
    const reader = createMemoryAnalyticsReader({
      answer: (statement) => {
        if (statement.includes("AS person"))
          return [
            {
              person: "ada",
              event: "auth.signed_up",
              s1: "password",
              n1: 0,
              first_at: "2026-11-08 10:00:00",
            },
          ];
        if (statement.includes("AS route"))
          return [
            {
              route: "/mcp",
              status: "200",
              requests: 4,
              seconds: 0.4,
              slowest: 0.2,
            },
          ];
        return [
          {
            event: "site.page_viewed",
            s1: "home",
            s2: "yes",
            s3: "",
            s4: "",
            n1: 0,
            total: 9,
          },
        ];
      },
    });
    const report = await getAnalyticsReport(
      { clock },
      { ...settings, reader },
      { days: 30 }
    );
    if (report.status !== "ok") throw new Error("expected a report");
    expect(reader.asked).toHaveLength(3);
    expect(reader.asked.join(" ")).toContain("INTERVAL '30' DAY");
    expect(report.funnel[0]).toMatchObject({ id: "visit", count: 9 });
    expect(report.activation.cohort).toBe(1);
    expect(report.routes).toEqual([
      { route: "/mcp", requests: 4, errors: 0, meanMs: 100, slowestMs: 200 },
    ]);
    expect(report.notes.join(" ")).toContain("WEB_ANALYTICS_SITE_TAG");
  });

  it("reads Web Analytics with the site tag and account", async () => {
    const variables: Record<string, unknown>[] = [];
    const reader = createMemoryAnalyticsReader({
      answer: () => [],
      webAnalytics: (_query, vars) => {
        variables.push(vars);
        return {
          viewer: {
            accounts: [{ total: [{ count: 3, sum: { visits: 2 } }] }],
          },
        };
      },
    });
    const report = await getAnalyticsReport(
      { clock },
      {
        ...settings,
        reader,
        webAnalyticsSiteTag: "fedcba9876543210fedcba9876543210",
      },
      { days: 1 }
    );
    expect(variables).toEqual([
      {
        accountTag: settings.accountId,
        siteTag: "fedcba9876543210fedcba9876543210",
        since: "2026-11-08T12:00:00.000Z",
        until: "2026-11-09T12:00:00.000Z",
      },
    ]);
    expect(report).toMatchObject({
      sources: { webAnalytics: { visits: 2, pageViews: 3 } },
    });
  });

  it("turns a failing optional part into a note, and a failing events query into ANALYTICS_UNAVAILABLE", async () => {
    const logger = createMemoryLogger();
    const routesFail = createMemoryAnalyticsReader({
      answer: (statement) => {
        if (statement.includes("AS route"))
          throw new AnalyticsReadError("unavailable", "metrics down");
        return [];
      },
    });
    const report = await getAnalyticsReport(
      { clock, logger },
      { ...settings, reader: routesFail },
      { days: 7 }
    );
    expect(report).toMatchObject({ status: "ok", routes: null });
    expect(report.status === "ok" && report.notes.join(" ")).toContain(
      "Errors and latency per route could not be read: metrics down"
    );
    expect(logger.records.map((record) => record.body)).toContain(
      "product_analytics.read_failed"
    );

    const refused = createMemoryAnalyticsReader({
      answer: () => {
        throw new AnalyticsReadError(
          "unauthorized",
          "Cloudflare refused the analytics token"
        );
      },
    });
    await expect(
      getAnalyticsReport(
        { clock },
        { ...settings, reader: refused },
        { days: 7 }
      )
    ).rejects.toMatchObject({
      code: "ANALYTICS_UNAVAILABLE",
      message: "Cloudflare refused the analytics token",
    });
  });
});
