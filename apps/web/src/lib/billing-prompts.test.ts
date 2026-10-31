import { describe, expect, it } from "vitest";

import {
  checkoutInputFor,
  formatMetric,
  limitRefusalOf,
  periodResetLabel,
  trialDaysLeft,
  trialNotice,
  upgradePromptFor,
} from "./billing-prompts";

const MB = 1024 * 1024;

const storageDetails = {
  metric: "storage_bytes",
  limit: 100 * MB,
  current: 100 * MB,
  increment: 2048,
  planId: "free",
  upgrade: { planIds: ["pro"], addonIds: ["extra_storage"] },
};

describe("limitRefusalOf", () => {
  it("reads a tRPC error's appCode and domain details", () => {
    const error = Object.assign(new Error("limit"), {
      data: {
        code: "FORBIDDEN",
        appCode: "LIMIT_REACHED",
        domain: { kind: "limit_reached", details: storageDetails },
      },
    });
    expect(limitRefusalOf(error)).toEqual({
      code: "LIMIT_REACHED",
      metric: "storage_bytes",
      limit: 100 * MB,
      current: 100 * MB,
      feature: undefined,
      planId: "free",
      upgrade: { planIds: ["pro"], addonIds: ["extra_storage"] },
    });
  });

  it("reads a Problem Details body of /api/files", () => {
    const body = {
      type: "about:blank",
      title: "Limit Reached",
      status: 403,
      detail: "This workspace has reached its storage_bytes limit",
      kind: "limit_reached",
      code: "LIMIT_REACHED",
      ...storageDetails,
    };
    expect(limitRefusalOf(body)).toMatchObject({
      code: "LIMIT_REACHED",
      metric: "storage_bytes",
      limit: 100 * MB,
    });
  });

  it("reads a feature refusal", () => {
    const error = {
      data: {
        appCode: "FEATURE_NOT_INCLUDED",
        domain: {
          kind: "limit_reached",
          details: {
            feature: "files.presigned_upload",
            planId: "free",
            upgrade: { planIds: ["pro"], addonIds: ["direct_uploads"] },
          },
        },
      },
    };
    expect(limitRefusalOf(error)).toMatchObject({
      code: "FEATURE_NOT_INCLUDED",
      feature: "files.presigned_upload",
    });
  });

  it("is null for other failures and malformed details", () => {
    expect(limitRefusalOf(new Error("Network down"))).toBeNull();
    expect(limitRefusalOf(null)).toBeNull();
    expect(
      limitRefusalOf({
        data: { appCode: "NOT_FOUND", domain: { kind: "not_found" } },
      })
    ).toBeNull();
    expect(limitRefusalOf({ data: { appCode: "REAUTH_REQUIRED" } })).toBeNull();
    expect(
      limitRefusalOf({ kind: "rate_limited", code: "RATE_LIMITED" })
    ).toBeNull();
    // An unknown code under limit_reached is not guessed at.
    expect(
      limitRefusalOf({
        data: {
          appCode: "SOMETHING",
          domain: { kind: "limit_reached", details: {} },
        },
      })
    ).toBeNull();
    // Missing upgrade options become empty lists.
    expect(
      limitRefusalOf({
        kind: "limit_reached",
        code: "LIMIT_REACHED",
        metric: "seats",
      })
    ).toMatchObject({ upgrade: { planIds: [], addonIds: [] } });
  });
});

describe("upgradePromptFor", () => {
  it("names the metric and its limit, and offers plans before add-ons", () => {
    const refusal = limitRefusalOf({
      kind: "limit_reached",
      code: "LIMIT_REACHED",
      ...storageDetails,
    });
    expect(refusal && upgradePromptFor(refusal)).toEqual({
      reason: { kind: "limit", subject: "storage", limit: "100 MB" },
      options: [
        { id: "plan:pro", label: "Upgrade to Pro" },
        { id: "addon:extra_storage", label: "Add Extra 10 GB" },
      ],
    });
  });

  it("names a feature by its label", () => {
    expect(
      upgradePromptFor({
        code: "FEATURE_NOT_INCLUDED",
        feature: "files.presigned_upload",
        upgrade: { planIds: [], addonIds: ["direct_uploads"] },
      })
    ).toEqual({
      reason: { kind: "feature", feature: "Direct uploads" },
      options: [{ id: "addon:direct_uploads", label: "Add Direct uploads" }],
    });
  });

  it("formats counts and falls back to ids it does not know", () => {
    expect(formatMetric("seats", 1200)).toBe("1,200");
    expect(
      upgradePromptFor({
        code: "LIMIT_REACHED",
        metric: "api_calls",
        limit: 5,
        upgrade: { planIds: ["enterprise"], addonIds: [] },
      })
    ).toEqual({
      reason: { kind: "limit", subject: "api_calls", limit: "5" },
      options: [{ id: "plan:enterprise", label: "Upgrade to enterprise" }],
    });
  });
});

describe("checkoutInputFor", () => {
  it("buys a plan, or one add-on on the current plan", () => {
    expect(checkoutInputFor("plan:pro", "free")).toEqual({
      planId: "pro",
      addons: [],
    });
    expect(checkoutInputFor("addon:extra_seats", "free")).toEqual({
      planId: "free",
      addons: [{ addonId: "extra_seats", quantity: 1 }],
    });
  });
});

describe("trialDaysLeft and periodResetLabel", () => {
  it("counts whole days left, never below 0", () => {
    const now = new Date("2026-10-28T12:00:00.000Z");
    expect(trialDaysLeft("2026-11-09T11:00:00.000Z", now)).toBe(11);
    expect(trialDaysLeft("2026-10-01T00:00:00.000Z", now)).toBe(0);
  });

  it("names the first day of the next month, across a year end", () => {
    expect(periodResetLabel("2026-10")).toBe("1 November");
    expect(periodResetLabel("2026-12")).toBe("1 January");
  });
});

describe("trialNotice", () => {
  const now = new Date("2026-10-28T12:00:00.000Z");
  const trialing = {
    mode: "manual" as const,
    planId: "pro",
    planName: "Pro",
    status: "trialing",
    trialEndsAt: "2026-10-31T18:00:00.000Z",
  };

  it("announces a trial ending within 7 days, in whole days", () => {
    expect(trialNotice(trialing, now)).toEqual({
      kind: "trial-ending",
      planName: "Pro",
      daysLeft: 3,
    });
    expect(
      trialNotice({ ...trialing, trialEndsAt: "2026-10-28T20:00:00.000Z" }, now)
    ).toMatchObject({ daysLeft: 0 });
    expect(
      trialNotice({ ...trialing, trialEndsAt: "2026-11-04T12:00:00.000Z" }, now)
    ).toMatchObject({ daysLeft: 7 });
  });

  it("stays quiet about a trial with more than 7 days left", () => {
    expect(
      trialNotice({ ...trialing, trialEndsAt: "2026-11-04T12:00:01.000Z" }, now)
    ).toBeNull();
  });

  it("announces a trial that ended in the last 7 days on its fallback plan", () => {
    const lapsed = {
      ...trialing,
      planId: "free",
      planName: "Free",
      status: "active",
      trialEndsAt: "2026-10-26T00:00:00.000Z",
    };
    expect(trialNotice(lapsed, now)).toEqual({
      kind: "trial-ended",
      planName: "Free",
    });
    expect(
      trialNotice({ ...lapsed, trialEndsAt: "2026-10-20T00:00:00.000Z" }, now)
    ).toBeNull();
    // Paid for the trial's plan: no news.
    expect(
      trialNotice({ ...lapsed, planId: "pro", planName: "Pro" }, now)
    ).toBeNull();
  });

  it("does not call an internal plan or unpaid subscription a lapsed trial", () => {
    const ended = {
      ...trialing,
      status: "active",
      trialEndsAt: "2026-10-26T00:00:00.000Z",
    };
    expect(
      trialNotice({ ...ended, planId: "unlimited", planName: "Unlimited" }, now)
    ).toBeNull();
    expect(
      trialNotice({ ...ended, planId: "free", status: "past_due" }, now)
    ).toBeNull();
  });

  it("says nothing with billing off or without a trial", () => {
    expect(trialNotice({ ...trialing, mode: "off" }, now)).toBeNull();
    expect(trialNotice({ ...trialing, trialEndsAt: null }, now)).toBeNull();
  });
});
