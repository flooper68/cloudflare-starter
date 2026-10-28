import { describe, expect, it } from "vitest";

import {
  auditTrail,
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import type { SubscriptionChange } from "../platform";
import { WorkspaceNotFoundError } from "../workspaces";
import { applySubscriptionChange } from "./apply-subscription-change";
import { UnknownCatalogKeyError } from "./domain";

const event = (
  workspaceId: string,
  overrides: Partial<SubscriptionChange> = {}
): SubscriptionChange => ({
  workspaceId,
  planId: "pro",
  status: "active",
  periodStart: new Date("2026-10-01T00:00:00.000Z"),
  periodEnd: new Date("2026-11-01T00:00:00.000Z"),
  trialEndsAt: null,
  provider: "stripe",
  customerId: "cus_acme",
  subscriptionId: "sub_acme",
  addons: [{ addonId: "extra_seats", quantity: 2 }],
  occurredAt: new Date("2026-10-28T10:00:00.000Z"),
  ...overrides,
});

describe("applySubscriptionChange", () => {
  it("stores the provider's state and add-ons, ignores older events, audits each applied one", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-provider" });
    const deps = billingDeps("provider");

    expect(
      await applySubscriptionChange(deps, event(actor.workspaceId))
    ).toEqual({ applied: true });
    // The same event redelivered: nothing written, nothing audited.
    expect(
      await applySubscriptionChange(deps, event(actor.workspaceId))
    ).toEqual({ applied: false });
    // Redelivered out of order: an older event changes nothing.
    expect(
      await applySubscriptionChange(
        deps,
        event(actor.workspaceId, {
          planId: "free",
          occurredAt: new Date("2026-10-27T10:00:00.000Z"),
        })
      )
    ).toEqual({ applied: false });
    expect(
      await applySubscriptionChange(
        deps,
        event(actor.workspaceId, {
          status: "past_due",
          addons: undefined,
          occurredAt: new Date("2026-10-28T11:00:00.000Z"),
        })
      )
    ).toEqual({ applied: true });

    expect(
      await rows(
        "SELECT plan_id, status, provider, provider_customer_id, provider_subscription_id FROM workspace_subscription WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([
      {
        plan_id: "pro",
        status: "past_due",
        provider: "stripe",
        provider_customer_id: "cus_acme",
        provider_subscription_id: "sub_acme",
      },
    ]);
    expect(
      await rows(
        "SELECT addon_id, quantity FROM workspace_addon WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([{ addon_id: "extra_seats", quantity: 2 }]);
    expect(
      (await auditTrail(actor.workspaceId)).map((e) => [e.action, e.metadata])
    ).toEqual([
      [
        "billing.subscription_changed",
        {
          previousPlanId: null,
          planId: "pro",
          status: "active",
          provider: "stripe",
        },
      ],
      [
        "billing.subscription_changed",
        {
          previousPlanId: "pro",
          planId: "pro",
          status: "past_due",
          provider: "stripe",
        },
      ],
    ]);
  });

  it("refuses unknown workspaces and catalog ids", async () => {
    await expect(
      applySubscriptionChange(billingDeps("provider"), event("ws-missing"))
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);
    await expect(
      applySubscriptionChange(
        billingDeps("provider"),
        event("ws-missing", { planId: "platinum" })
      )
    ).rejects.toBeInstanceOf(UnknownCatalogKeyError);
  });
});
