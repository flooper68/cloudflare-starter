import { describe, expect, it } from "vitest";

import {
  auditTrail,
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { startTrial } from "./start-trial";

describe("startTrial", () => {
  it("starts the new-workspace plan's trial once and audits it", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-new" });
    expect(await startTrial(billingDeps(), actor.workspaceId)).toEqual({
      started: true,
    });
    expect(await startTrial(billingDeps(), actor.workspaceId)).toEqual({
      started: false,
    });
    expect(
      await rows(
        "SELECT plan_id, status, provider, trial_ends_at FROM workspace_subscription WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([
      {
        plan_id: "pro",
        status: "trialing",
        provider: "manual",
        trial_ends_at: Date.parse("2026-11-11T12:00:00.000Z"),
      },
    ]);
    expect(await auditTrail(actor.workspaceId)).toEqual([
      {
        action: "billing.trial_started",
        actor: null,
        target: `workspace:${actor.workspaceId}`,
        metadata: { planId: "pro", trialEndsAt: "2026-11-11T12:00:00.000Z" },
      },
    ]);
  });

  it("does nothing with billing off", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-new-off" });
    expect(await startTrial(billingDeps("off"), actor.workspaceId)).toEqual({
      started: false,
    });
    expect(
      await rows(
        "SELECT * FROM workspace_subscription WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([]);
  });
});
