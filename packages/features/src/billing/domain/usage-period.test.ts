import { describe, expect, it } from "vitest";

import { billingSettingsSchema } from "./settings";
import {
  assignPlanInputSchema,
  setOverrideInputSchema,
  subscriptionChangeSchema,
} from "./subscription";
import { usagePeriod } from "./usage-period";

describe("usagePeriod", () => {
  it("is the UTC calendar month", () => {
    expect(usagePeriod(new Date("2026-10-31T23:59:59.999Z"))).toBe("2026-10");
    expect(usagePeriod(new Date("2026-11-01T00:00:00.000Z"))).toBe("2026-11");
  });
});

describe("billing settings", () => {
  it("needs BILLING to be off, manual or provider", () => {
    expect(billingSettingsSchema.parse({ BILLING: "provider" })).toEqual({
      mode: "provider",
    });
    expect(billingSettingsSchema.safeParse({}).success).toBe(false);
    expect(billingSettingsSchema.safeParse({ BILLING: "on" }).success).toBe(
      false
    );
  });
});

describe("billing inputs", () => {
  it("needs trialEndsAt to assign a trialing plan", () => {
    expect(
      assignPlanInputSchema.safeParse({
        workspaceId: "ws-acme",
        planId: "pro",
        status: "trialing",
      }).success
    ).toBe(false);
    expect(
      assignPlanInputSchema.parse({ workspaceId: "ws-acme", planId: "pro" })
    ).toEqual({
      workspaceId: "ws-acme",
      planId: "pro",
      status: "active",
      trialEndsAt: null,
      periodEnd: null,
    });
  });

  it("takes an override with a reason, or null to remove it", () => {
    expect(
      setOverrideInputSchema.safeParse({
        workspaceId: "ws-acme",
        key: "seats",
        override: { kind: "limit", limit: -1 },
        reason: "Pilot",
      }).success
    ).toBe(false);
    expect(
      setOverrideInputSchema.safeParse({
        workspaceId: "ws-acme",
        key: "seats",
        override: null,
        reason: "",
      }).success
    ).toBe(false);
  });

  it("refuses a subscription change that names an add-on twice", () => {
    const change = {
      workspaceId: "ws-acme",
      planId: "pro",
      status: "active",
      periodStart: null,
      periodEnd: null,
      trialEndsAt: null,
      provider: "stripe",
      customerId: null,
      subscriptionId: null,
      occurredAt: new Date("2026-10-28T12:00:00.000Z"),
    };
    expect(subscriptionChangeSchema.safeParse(change).success).toBe(true);
    expect(
      subscriptionChangeSchema.safeParse({
        ...change,
        addons: [
          { addonId: "extra_seats", quantity: 1 },
          { addonId: "extra_seats", quantity: 2 },
        ],
      }).success
    ).toBe(false);
  });
});
