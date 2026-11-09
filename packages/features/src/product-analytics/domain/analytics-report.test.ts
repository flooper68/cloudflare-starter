import { describe, expect, it } from "vitest";

import {
  buildAnalyticsReport,
  PEOPLE_REPORT_EVENTS,
  parseTimestamp,
  parseWebAnalytics,
  ROW_LIMIT,
  reportQueries,
  SITE_REPORT_EVENTS,
} from "./analytics-report";

const datasets = {
  events: "cloudflare_starter_production_product_events",
  metrics: "cloudflare_starter_production_metrics",
};

describe("reportQueries", () => {
  it("reads the site and people events of the period, weighted by the sample interval", () => {
    const queries = reportQueries(datasets, 7);
    expect(queries.site).toContain(
      "FROM cloudflare_starter_production_product_events"
    );
    expect(queries.site).toContain("timestamp > NOW() - INTERVAL '7' DAY");
    expect(queries.site).toContain("SUM(_sample_interval) AS total");
    for (const event of SITE_REPORT_EVENTS)
      expect(queries.site).toContain(`index1 = '${event}'`);
    expect(queries.people).toContain("blob2 != ''");
    expect(queries.people).toContain("min(timestamp) AS first_at");
    for (const event of PEOPLE_REPORT_EVENTS)
      expect(queries.people).toContain(`index1 = '${event}'`);
    expect(queries.routes).toContain(
      "FROM cloudflare_starter_production_metrics"
    );
    expect(queries.routes).toContain("index1 = 'http.server.request.duration'");
  });

  it("leaves routes out without the metrics dataset", () => {
    expect(reportQueries({ ...datasets, metrics: null }, 1).routes).toBeNull();
  });

  it.each([
    ["events", { ...datasets, events: "x; DROP TABLE y" }],
    ["metrics", { ...datasets, metrics: "a b" }],
  ])("refuses a %s dataset name that is not a wrangler name", (_, bad) => {
    expect(() => reportQueries(bad, 7)).toThrow(/dataset name/);
  });

  it("refuses a period that is not offered", () => {
    expect(() => reportQueries(datasets, 3 as 7)).toThrow(/period/);
  });
});

describe("parseTimestamp", () => {
  it("reads the SQL API's UTC format and ISO", () => {
    expect(parseTimestamp("2026-11-09 10:00:00")).toBe(
      Date.parse("2026-11-09T10:00:00Z")
    );
    expect(parseTimestamp("2026-11-09T10:00:00Z")).toBe(
      Date.parse("2026-11-09T10:00:00Z")
    );
    expect(parseTimestamp("not a time")).toBeNaN();
  });
});

const site = [
  // Entry views by referrer, one internal view.
  {
    event: "site.page_viewed",
    s1: "home",
    s2: "yes",
    s3: "news.ycombinator.com",
    s4: "",
    n1: 0,
    total: "40",
  },
  {
    event: "site.page_viewed",
    s1: "home",
    s2: "yes",
    s3: "",
    s4: "newsletter",
    n1: 0,
    total: 10,
  },
  {
    event: "site.page_viewed",
    s1: "docs",
    s2: "no",
    s3: "",
    s4: "",
    n1: 0,
    total: 30,
  },
  {
    event: "site.page_scrolled",
    s1: "home",
    s2: "",
    s3: "",
    s4: "",
    n1: 50,
    total: 20,
  },
  {
    event: "site.page_scrolled",
    s1: "docs",
    s2: "",
    s3: "",
    s4: "",
    n1: 50,
    total: 99,
  },
  {
    event: "site.page_engaged",
    s1: "home",
    s2: "scrolled",
    s3: "yes",
    s4: "",
    n1: 0,
    total: 25,
  },
  // Later pages of a visit (a docs reader's next pages): not visits, not interest.
  {
    event: "site.page_engaged",
    s1: "docs",
    s2: "docs",
    s3: "no",
    s4: "",
    n1: 0,
    total: 100,
  },
  {
    event: "site.cta_clicked",
    s1: "demo",
    s2: "hero",
    s3: "yes",
    s4: "no",
    n1: 0,
    total: 12,
  },
  // A second click in the same view: in the breakdown, not in the intent step.
  {
    event: "site.cta_clicked",
    s1: "github",
    s2: "hero",
    s3: "yes",
    s4: "yes",
    n1: 0,
    total: 3,
  },
  {
    event: "site.video_played",
    s1: "intro",
    s2: "",
    s3: "",
    s4: "",
    n1: 0,
    total: 8,
  },
  {
    event: "site.video_completed",
    s1: "intro",
    s2: "",
    s3: "",
    s4: "",
    n1: 0,
    total: 5,
  },
  {
    event: "site.feature_map_used",
    s1: "select",
    s2: "",
    s3: "",
    s4: "",
    n1: 0,
    total: 6,
  },
  {
    event: "docs.page_viewed",
    s1: "guides",
    s2: "",
    s3: "",
    s4: "",
    n1: 0,
    total: 30,
  },
  {
    event: "auth.sign_up_started",
    s1: "password",
    s2: "",
    s3: "",
    s4: "",
    n1: 0,
    total: 7,
  },
  {
    event: "auth.sign_up_failed",
    s1: "bot_check",
    s2: "",
    s3: "",
    s4: "",
    n1: 0,
    total: 2,
  },
];

const people = [
  // Ada: signed up, tried notes after 4 minutes, then files and the palette, came back on day 2.
  {
    person: "ada",
    event: "auth.signed_up",
    s1: "password",
    n1: 0,
    first_at: "2026-11-08 10:00:00",
  },
  {
    person: "ada",
    event: "app.feature_tried",
    s1: "notes",
    n1: 0,
    first_at: "2026-11-08 10:04:00",
  },
  {
    person: "ada",
    event: "app.feature_tried",
    s1: "files",
    n1: 0,
    first_at: "2026-11-08 10:30:00",
  },
  {
    person: "ada",
    event: "app.feature_tried",
    s1: "command_palette",
    n1: 0,
    first_at: "2026-11-08 11:00:00",
  },
  {
    person: "ada",
    event: "app.session_returned",
    s1: "",
    n1: 2,
    first_at: "2026-11-10 09:00:00",
  },
  // Grace: signed up, tried the agent after 10 minutes, came back after 9 days.
  {
    person: "grace",
    event: "auth.signed_up",
    s1: "social",
    n1: 0,
    first_at: "2026-11-08 12:00:00",
  },
  {
    person: "grace",
    event: "app.feature_tried",
    s1: "agents",
    n1: 0,
    first_at: "2026-11-08 12:10:00",
  },
  {
    person: "grace",
    event: "app.session_returned",
    s1: "",
    n1: 9,
    first_at: "2026-11-17 09:00:00",
  },
  // Linus: signed up, tried nothing.
  {
    person: "linus",
    event: "auth.signed_up",
    s1: "password",
    n1: 0,
    first_at: "2026-11-08 13:00:00",
  },
  // Old: signed up before the period, tried notes in it.
  {
    person: "old",
    event: "app.feature_tried",
    s1: "notes",
    n1: 0,
    first_at: "2026-11-08 14:00:00",
  },
];

const routes = [
  {
    route: "/api/trpc/[...trpc]",
    status: "200",
    requests: 90,
    seconds: 4.5,
    slowest: 1.2,
  },
  {
    route: "/api/trpc/[...trpc]",
    status: "500",
    requests: 10,
    seconds: 0.5,
    slowest: 0.3,
  },
  {
    route: "/app/[...path]",
    status: "200",
    requests: 50,
    seconds: 5,
    slowest: 0.4,
  },
];

const report = buildAnalyticsReport({
  days: 7,
  now: new Date("2026-11-09T12:00:00Z"),
  site,
  people,
  routes,
  webAnalytics: null,
});

describe("buildAnalyticsReport", () => {
  it("counts the funnel from visits to returns within 7 days", () => {
    expect(
      report.funnel.map((step) => [step.id, step.unit, step.count])
    ).toEqual([
      ["visit", "visits", 50],
      ["interest", "visits", 25],
      ["intent", "visits", 12],
      ["sign_up_started", "attempts", 7],
      ["signed_up", "people", 3],
      ["first_try", "people", 2],
      ["depth", "people", 1],
      ["returned", "people", 1],
    ]);
  });

  it("gives each step its share of the step above, never more than 100 %", () => {
    expect(report.funnel.map((step) => step.share)).toEqual([
      null,
      0.5,
      0.48,
      7 / 12,
      // 3 people from 7 attempts.
      3 / 7,
      2 / 3,
      0.5,
      1,
    ]);
    // One visitor reads four docs pages and signs up from a link elsewhere: the later
    // pages are no extra visits, and sign-ups above attempts show as 100 %.
    const reader = buildAnalyticsReport({
      days: 7,
      now: new Date("2026-11-09T12:00:00Z"),
      site: [
        {
          event: "site.page_viewed",
          s1: "docs",
          s2: "yes",
          s3: "",
          s4: "",
          n1: 0,
          total: 1,
        },
        {
          event: "site.page_viewed",
          s1: "docs",
          s2: "no",
          s3: "",
          s4: "",
          n1: 0,
          total: 3,
        },
        {
          event: "site.page_engaged",
          s1: "docs",
          s2: "docs",
          s3: "yes",
          s4: "",
          n1: 0,
          total: 1,
        },
        {
          event: "site.page_engaged",
          s1: "docs",
          s2: "docs",
          s3: "no",
          s4: "",
          n1: 0,
          total: 3,
        },
        {
          event: "site.cta_clicked",
          s1: "demo",
          s2: "header",
          s3: "no",
          s4: "no",
          n1: 0,
          total: 4,
        },
      ],
      people: [
        {
          person: "p1",
          event: "auth.signed_up",
          s1: "social",
          n1: 0,
          first_at: "2026-11-08 10:00:00",
        },
        {
          person: "p2",
          event: "auth.signed_up",
          s1: "social",
          n1: 0,
          first_at: "2026-11-08 11:00:00",
        },
      ],
      routes: null,
      webAnalytics: null,
    });
    expect(reader.funnel.map((step) => step.count).slice(0, 5)).toEqual([
      1, 1, 0, 0, 2,
    ]);
    for (const step of reader.funnel) {
      expect(step.share ?? 0).toBeGreaterThanOrEqual(0);
      expect(step.share ?? 0).toBeLessThanOrEqual(1);
    }
    for (const step of report.funnel)
      expect(step.share ?? 0).toBeLessThanOrEqual(1);
  });

  it("finds the first feature and the median time to it among the period's sign-ups", () => {
    expect(report.activation).toEqual({
      cohort: 3,
      tried: 2,
      medianMinutesToFirstTry: 7,
      firstFeatures: [
        { feature: "agents", label: "Agent (MCP) connected", people: 1 },
        { feature: "notes", label: "Notes", people: 1 },
      ],
      depth: [
        { key: "0", count: 1 },
        { key: "1", count: 1 },
        { key: "2", count: 0 },
        { key: "3+", count: 1 },
      ],
      returnedWithinWindow: 1,
    });
  });

  it("ranks features by the people who tried them, any sign-up date", () => {
    expect(report.features.map((row) => [row.feature, row.people])).toEqual([
      ["notes", 2],
      ["agents", 1],
      ["command_palette", 1],
      ["files", 1],
    ]);
  });

  it("breaks the public steps down by source, page, scroll, video, map, docs and call to action", () => {
    expect(report.sources.referrers).toEqual([
      { key: "news.ycombinator.com", count: 40 },
      { key: "", count: 10 },
    ]);
    expect(report.sources.campaigns).toEqual([
      { key: "newsletter", count: 10 },
    ]);
    expect(report.engagement.pages).toEqual([
      { key: "home", count: 50 },
      { key: "docs", count: 30 },
    ]);
    // Only the home page's scroll depth.
    expect(report.engagement.scrollDepth).toEqual([
      { key: "25", count: 0 },
      { key: "50", count: 20 },
      { key: "75", count: 0 },
      { key: "100", count: 0 },
    ]);
    expect(report.engagement.videos).toEqual([
      { video: "intro", played: 8, completed: 5 },
    ]);
    expect(report.engagement.featureMap).toEqual([{ key: "select", count: 6 }]);
    expect(report.engagement.docsSections).toEqual([
      { key: "guides", count: 30 },
    ]);
    expect(report.ctas).toEqual([
      { cta: "demo", placement: "hero", clicks: 12 },
      { cta: "github", placement: "hero", clicks: 3 },
    ]);
    expect(report.signUp).toEqual({
      started: 7,
      completed: 3,
      failures: [{ key: "bot_check", count: 2 }],
    });
  });

  it("puts the route with server errors first, with its mean and slowest duration", () => {
    expect(report.routes).toEqual([
      {
        route: "/api/trpc/[...trpc]",
        requests: 100,
        errors: 10,
        meanMs: 50,
        slowestMs: 1200,
      },
      {
        route: "/app/[...path]",
        requests: 50,
        errors: 0,
        meanMs: 100,
        slowestMs: 400,
      },
    ]);
  });

  it("says when rows were cut", () => {
    const many = Array.from({ length: ROW_LIMIT }, () => site[0] ?? {});
    const cut = buildAnalyticsReport({
      days: 30,
      now: new Date("2026-11-09T12:00:00Z"),
      site: many,
      people: [],
      routes: null,
      webAnalytics: null,
    });
    expect(cut.notes.join(" ")).toContain(`More than ${ROW_LIMIT} rows`);
    expect(cut.routes).toBeNull();
  });

  it("reads an empty period as zeros", () => {
    const empty = buildAnalyticsReport({
      days: 1,
      now: new Date("2026-11-09T12:00:00Z"),
      site: [],
      people: [],
      routes: [],
      webAnalytics: null,
    });
    expect(empty.funnel.every((step) => step.count === 0)).toBe(true);
    expect(empty.activation.medianMinutesToFirstTry).toBeNull();
    expect(empty.routes).toEqual([]);
  });
});

describe("parseWebAnalytics", () => {
  it("reads visits, page views, referrers and countries", () => {
    expect(
      parseWebAnalytics({
        viewer: {
          accounts: [
            {
              total: [{ count: 500, sum: { visits: 210 } }],
              referrers: [
                {
                  sum: { visits: 120 },
                  dimensions: { refererHost: "github.com" },
                },
              ],
              countries: [
                { sum: { visits: 90 }, dimensions: { countryName: "CZ" } },
              ],
            },
          ],
        },
      })
    ).toEqual({
      visits: 210,
      pageViews: 500,
      referrers: [{ key: "github.com", count: 120 }],
      countries: [{ key: "CZ", count: 90 }],
    });
  });

  it("is null without an account", () => {
    expect(parseWebAnalytics({ viewer: { accounts: [] } })).toBeNull();
    expect(parseWebAnalytics(null)).toBeNull();
  });
});
