import { describe, expect, it } from "vitest";

import {
  ADDONS,
  CATALOG,
  type Catalog,
  DEFAULT_PLAN_ID,
  FEATURES,
  findAddon,
  findPlan,
  isFeatureKey,
  isMetricKey,
  METRICS,
  NEW_WORKSPACE_PLAN_ID,
  PLANS,
  UNLIMITED_PLAN,
  validateCatalog,
} from "./catalog";

describe("billing catalog", () => {
  it("is valid", () => {
    expect(validateCatalog(CATALOG)).toEqual([]);
  });

  it("gives every plan a fallback that exists and has no trial", () => {
    for (const plan of PLANS) {
      const fallback = findPlan(plan.fallbackPlanId);
      expect(fallback, plan.id).toBeDefined();
      expect(fallback?.trialDays, plan.id).toBeUndefined();
    }
  });

  it("lets add-ons name only known features and metrics", () => {
    for (const addon of ADDONS) {
      for (const feature of addon.features ?? [])
        expect(isFeatureKey(feature), addon.id).toBe(true);
      for (const metric of Object.keys(addon.limits ?? {}))
        expect(isMetricKey(metric), addon.id).toBe(true);
    }
  });

  it("gives every metric a source and period metrics a reset", () => {
    for (const [key, metric] of Object.entries(METRICS)) {
      expect(metric.source.length, key).toBeGreaterThan(0);
      if (metric.kind === "period") expect(metric.reset, key).toBe("month");
    }
  });

  it("has an internal unlimited plan with every feature and no limits", () => {
    expect(UNLIMITED_PLAN.internal).toBe(true);
    expect([...UNLIMITED_PLAN.features].sort()).toEqual(
      Object.keys(FEATURES).sort()
    );
    expect(Object.values(UNLIMITED_PLAN.limits).every((v) => v === null)).toBe(
      true
    );
    expect(findPlan(NEW_WORKSPACE_PLAN_ID)?.trialDays).toBeGreaterThan(0);
    expect(findPlan(DEFAULT_PLAN_ID)).toBeDefined();
    expect(findAddon("extra_seats")?.limits?.seats).toBe(5);
    expect(findPlan("enterprise")).toBeUndefined();
  });

  it("reports what makes a catalog unusable", () => {
    const broken: Catalog = {
      ...CATALOG,
      plans: [
        {
          id: "basic",
          name: "Basic",
          features: ["files.reports" as never],
          limits: { storage_bytes: 1 } as never,
          fallbackPlanId: "trial",
        },
        {
          id: "trial",
          name: "Trial",
          features: [],
          limits: {
            storage_bytes: 1,
            "files.uploads_per_month": 1,
            seats: 1,
          },
          trialDays: 7,
          fallbackPlanId: "missing",
        },
      ],
      addons: [
        { id: "basic", name: "Clash", limits: { bandwidth: 1 } as never },
      ],
      metrics: {
        ...CATALOG.metrics,
        exports: {
          kind: "period",
          source: " ",
          unit: "count",
          description: "",
        },
      },
      newWorkspacePlanId: "pro",
    };
    expect(validateCatalog(broken)).toEqual([
      "duplicate id basic",
      "metric exports has no source",
      "period metric exports has no reset",
      "plan basic: fallback trial has a trial",
      "plan basic: unknown feature files.reports",
      "plan basic: no limit for files.uploads_per_month (null is unlimited)",
      "plan basic: no limit for seats (null is unlimited)",
      "plan basic: no limit for exports (null is unlimited)",
      "plan trial: fallback missing is not a plan",
      "plan trial: no limit for exports (null is unlimited)",
      "addon basic: unknown metric bandwidth",
      "newWorkspacePlanId pro is not a plan",
      "defaultPlanId free is not a plan",
    ]);
  });
});
