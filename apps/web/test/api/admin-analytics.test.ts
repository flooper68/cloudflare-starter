/**
 * `admin.analytics.get` (and its MCP tool) through the real procedure: gated like every
 * admin procedure, "not configured" without the read token, and with it the report built
 * from Cloudflare's analytics APIs as test/analytics-fixture.ts answers them (outbound.ts).
 * Also the funnel's write side: a mutation, an MCP call and the command palette record a
 * feature tried once, and QA accounts are left out.
 */
import {
  analyticsEvents,
  decodeAnalyticsEngineDataPoint,
} from "@cloudflare-starter/features";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AppEnv } from "@/server/env";

import { ANALYTICS_FIXTURE } from "../analytics-fixture";
import { callerFor, env, signUp, type TestUser } from "./helpers";

const points: AnalyticsEngineDataPoint[] = [];

beforeAll(() => {
  const dataset = env.ANALYTICS_EVENTS as AnalyticsEngineDataset;
  const write = dataset.writeDataPoint.bind(dataset);
  dataset.writeDataPoint = (point) => {
    points.push(point ?? {});
    write(point);
  };
});
beforeEach(() => {
  points.length = 0;
});

const tried = () =>
  points
    .map((point) =>
      decodeAnalyticsEngineDataPoint(
        point,
        analyticsEvents.get(String(point.blobs?.[0]))?.layout
      )
    )
    .filter((point) => point.event === "app.feature_tried")
    .map((point) => point.properties.feature);

/** The Worker's env with the analytics read token and account of the fixture. */
const configured: AppEnv = {
  ...env,
  ANALYTICS_READ_TOKEN: ANALYTICS_FIXTURE.token,
  ANALYTICS_ACCOUNT_ID: ANALYTICS_FIXTURE.accountId,
  WEB_ANALYTICS_SITE_TAG: ANALYTICS_FIXTURE.siteTag,
};

async function makeAdmin(user: TestUser) {
  await env.DB.prepare("UPDATE user SET role = 'admin' WHERE id = ?")
    .bind(user.id)
    .run();
}

describe("admin.analytics.get", () => {
  let admin: TestUser;
  let member: TestUser;
  beforeAll(async () => {
    admin = await signUp("Ada Analytics", "ada-analytics@example.test");
    member = await signUp("Grace Analytics", "grace-analytics@example.test");
    await makeAdmin(admin);
  });

  it("is not found for anyone but an admin", async () => {
    await expect(
      callerFor(member, configured).admin.analytics.get({ days: 7 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerFor(null, configured).admin.analytics.get({ days: 7 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("names the missing settings without the read token", async () => {
    expect(await callerFor(admin).admin.analytics.get({ days: 7 })).toEqual({
      status: "not_configured",
      missing: ["ANALYTICS_READ_TOKEN", "ANALYTICS_ACCOUNT_ID"],
    });
  });

  it("builds the funnel from the SQL and GraphQL answers", async () => {
    const report = await callerFor(admin, configured).admin.analytics.get({
      days: 30,
    });
    if (report.status !== "ok") throw new Error("expected a report");
    expect(report.days).toBe(30);
    expect(
      Object.fromEntries(report.funnel.map((step) => [step.id, step.count]))
    ).toEqual({
      visit: 820,
      interest: 500,
      intent: 137,
      sign_up_started: 31,
      signed_up: 3,
      first_try: 2,
      depth: 1,
      returned: 1,
    });
    expect(report.activation.medianMinutesToFirstTry).toBe(7.5);
    expect(report.sources.referrers[0]).toEqual({
      key: "news.ycombinator.com",
      count: 420,
    });
    expect(report.sources.webAnalytics).toMatchObject({
      visits: 905,
      pageViews: 2140,
    });
    expect(report.routes?.[0]).toMatchObject({
      route: "/api/trpc/[...trpc]",
      errors: 4,
    });
  });

  it("answers PRECONDITION_FAILED with Cloudflare's reason when the token is refused", async () => {
    await expect(
      callerFor(admin, {
        ...configured,
        ANALYTICS_READ_TOKEN: "revoked-token",
      }).admin.analytics.get({ days: 7 })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Account Analytics Read"),
    });
  });
});

describe("the funnel's feature tries", () => {
  it("records a feature the first time a person uses it, never again", async () => {
    const linus = await signUp("Linus Tried", "linus-tried@example.test");
    points.length = 0;
    await callerFor(linus).notes.create({ title: "One", body: "" });
    await callerFor(linus).notes.create({ title: "Two", body: "" });
    await callerFor(linus).analytics.track({
      events: [
        {
          event: "app.command_palette_opened",
          properties: { source: "shortcut" },
        },
      ],
    });
    expect(tried()).toEqual(["notes", "command_palette"]);
  });

  it("leaves the QA suite's accounts out", async () => {
    const qa = await signUp("QA Run", "run-1@qa.flooper.me");
    points.length = 0;
    await callerFor(qa).notes.create({ title: "QA note", body: "" });
    expect(points).toEqual([]);
  });
});
