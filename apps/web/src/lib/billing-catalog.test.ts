import { ADDONS, FEATURES, METRICS, PLANS } from "@cloudflare-starter/features";
import { describe, expect, it } from "vitest";

import {
  BILLING_ADDONS,
  BILLING_FEATURES,
  BILLING_METRICS,
  BILLING_PLANS,
} from "./billing-catalog";

describe("the browser's copy of the billing catalog", () => {
  it("lists the catalog's plans with their names, internal flag and trial", () => {
    expect(BILLING_PLANS).toEqual(
      PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        fallbackPlanId: plan.fallbackPlanId,
        ...(plan.internal ? { internal: true } : {}),
        ...(plan.trialDays ? { trial: true } : {}),
      }))
    );
  });

  it("lists the catalog's add-ons with their names", () => {
    expect(BILLING_ADDONS).toEqual(
      ADDONS.map((addon) => ({ id: addon.id, name: addon.name }))
    );
  });

  it("has words for every metric, with the catalog's unit", () => {
    expect(Object.keys(BILLING_METRICS)).toEqual(Object.keys(METRICS));
    for (const [key, metric] of Object.entries(METRICS))
      expect(BILLING_METRICS[key]?.unit).toBe(metric.unit);
  });

  it("has a label for every feature", () => {
    expect(Object.keys(BILLING_FEATURES)).toEqual(Object.keys(FEATURES));
  });
});
