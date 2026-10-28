import { describe, expect, it } from "vitest";

import { findPlan, type Plan } from "./catalog";
import { type SubscriptionState, trialEndsAt, trialOutcome } from "./trial";

const now = new Date("2026-10-28T12:00:00.000Z");
const at = (iso: string) => new Date(iso);
const sub = (overrides: Partial<SubscriptionState>): SubscriptionState => ({
  planId: "pro",
  status: "active",
  trialEndsAt: null,
  periodEnd: null,
  ...overrides,
});

describe("trialOutcome", () => {
  it("keeps a running trial and expires an ended one to the fallback", () => {
    expect(
      trialOutcome(
        sub({
          status: "trialing",
          trialEndsAt: at("2026-10-28T12:00:01.000Z"),
        }),
        now
      )
    ).toEqual({ action: "keep" });
    expect(
      trialOutcome(sub({ status: "trialing", trialEndsAt: now }), now)
    ).toEqual({ action: "expire", toPlanId: "free", reason: "trial_ended" });
  });

  it("gives a past-due subscription a 7-day grace after its period", () => {
    const periodEnd = at("2026-10-21T12:00:00.000Z");
    expect(
      trialOutcome(
        sub({ status: "past_due", periodEnd }),
        at("2026-10-28T11:59:59.000Z")
      )
    ).toEqual({ action: "keep" });
    expect(trialOutcome(sub({ status: "past_due", periodEnd }), now)).toEqual({
      action: "expire",
      toPlanId: "free",
      reason: "past_due_grace_ended",
    });
    expect(trialOutcome(sub({ status: "past_due" }), now)).toEqual({
      action: "keep",
    });
  });

  it("keeps a canceled plan until its period ends", () => {
    expect(
      trialOutcome(
        sub({ status: "canceled", periodEnd: at("2026-11-01T00:00:00.000Z") }),
        now
      )
    ).toEqual({ action: "keep" });
    expect(
      trialOutcome(sub({ status: "canceled", periodEnd: now }), now)
    ).toEqual({ action: "expire", toPlanId: "free", reason: "period_ended" });
    expect(trialOutcome(sub({ status: "canceled" }), now)).toMatchObject({
      action: "expire",
    });
  });

  it("keeps active subscriptions, the fallback plan itself and unknown plans", () => {
    expect(trialOutcome(sub({}), now)).toEqual({ action: "keep" });
    expect(
      trialOutcome(
        sub({
          planId: "free",
          status: "past_due",
          periodEnd: at("2026-01-01T00:00:00.000Z"),
        }),
        now
      )
    ).toEqual({ action: "keep" });
    expect(
      trialOutcome(
        sub({ planId: "retired", status: "trialing", trialEndsAt: now }),
        now
      )
    ).toEqual({ action: "keep" });
  });
});

describe("trialEndsAt", () => {
  it("adds the plan's trial days, or is null without a trial", () => {
    expect(trialEndsAt(findPlan("pro") as Plan, now)).toEqual(
      at("2026-11-11T12:00:00.000Z")
    );
    expect(trialEndsAt(findPlan("free") as Plan, now)).toBeNull();
  });
});
