import { describe, expect, it } from "vitest";

import {
  auditTrail,
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { applySubscriptionChange } from "./apply-subscription-change";
import { expireTrials } from "./expire-trials";
import { startTrial } from "./start-trial";

const change = (
  workspaceId: string,
  status: "past_due" | "canceled",
  periodEnd: string
) => ({
  workspaceId,
  planId: "pro",
  status,
  periodStart: new Date("2026-09-01T00:00:00.000Z"),
  periodEnd: new Date(periodEnd),
  trialEndsAt: null,
  provider: "memory",
  customerId: `cus_${workspaceId}`,
  subscriptionId: `sub_${workspaceId}`,
  occurredAt: new Date("2026-10-01T00:00:00.000Z"),
});

describe("expireTrials", () => {
  it("lapses ended trials, unpaid and canceled subscriptions once, keeping the rest", async () => {
    const workspaces = [];
    for (const name of ["trial", "running", "unpaid", "grace", "canceled"]) {
      const owner = await seedUser(`Owner ${name}`);
      workspaces.push(
        (await seedWorkspace(owner.id, { id: `ws-${name}` })).workspaceId
      );
    }
    const [trial, running, unpaid, grace, canceled] = workspaces as [
      string,
      string,
      string,
      string,
      string,
    ];
    await startTrial(billingDeps("manual", "2026-10-01T00:00:00.000Z"), trial);
    await startTrial(
      billingDeps("manual", "2026-10-28T00:00:00.000Z"),
      running
    );
    await applySubscriptionChange(
      billingDeps(),
      change(unpaid, "past_due", "2026-10-15T00:00:00.000Z")
    );
    await applySubscriptionChange(
      billingDeps(),
      change(grace, "past_due", "2026-10-25T00:00:00.000Z")
    );
    await applySubscriptionChange(
      billingDeps(),
      change(canceled, "canceled", "2026-10-20T00:00:00.000Z")
    );

    const deps = billingDeps("manual", "2026-10-28T12:00:00.000Z");
    expect(await expireTrials(deps)).toEqual({ expired: 3 });
    expect(await expireTrials(deps)).toEqual({ expired: 0 });

    expect(
      await rows(
        "SELECT workspace_id, plan_id, status, provider_subscription_id FROM workspace_subscription ORDER BY workspace_id"
      )
    ).toEqual([
      {
        workspace_id: "ws-canceled",
        plan_id: "free",
        status: "active",
        provider_subscription_id: null,
      },
      {
        workspace_id: "ws-grace",
        plan_id: "pro",
        status: "past_due",
        provider_subscription_id: "sub_ws-grace",
      },
      {
        workspace_id: "ws-running",
        plan_id: "pro",
        status: "trialing",
        provider_subscription_id: null,
      },
      {
        workspace_id: "ws-trial",
        plan_id: "free",
        status: "active",
        provider_subscription_id: null,
      },
      {
        workspace_id: "ws-unpaid",
        plan_id: "free",
        status: "active",
        provider_subscription_id: "sub_ws-unpaid",
      },
    ]);
    expect((await auditTrail(trial)).at(-1)).toEqual({
      action: "billing.plan_lapsed",
      actor: null,
      target: "workspace:ws-trial",
      metadata: {
        previousPlanId: "pro",
        planId: "free",
        reason: "trial_ended",
      },
    });
    expect((await auditTrail(unpaid)).at(-1)?.metadata.reason).toBe(
      "past_due_grace_ended"
    );
    expect((await auditTrail(canceled)).at(-1)?.metadata.reason).toBe(
      "period_ended"
    );
  });
});
