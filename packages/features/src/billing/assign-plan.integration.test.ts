import { describe, expect, it } from "vitest";

import {
  auditTrail,
  billingDeps,
  rows,
  seedUser,
  seedWorkspace,
} from "../../test/fixtures";
import { WorkspaceNotFoundError } from "../workspaces";
import { assignPlan } from "./assign-plan";
import { TrialWithoutFallbackError, UnknownCatalogKeyError } from "./domain";

describe("assignPlan", () => {
  it("puts a workspace on a plan and audits the change", async () => {
    const owner = await seedUser();
    const admin = await seedUser("Alan Admin");
    const actor = await seedWorkspace(owner.id, { id: "ws-assign" });
    const deps = billingDeps();

    await assignPlan(
      deps,
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        planId: "pro",
        status: "trialing",
        trialEndsAt: "2026-12-01T00:00:00.000Z",
      }
    );
    await assignPlan(
      deps,
      { userId: admin.id },
      {
        workspaceId: actor.workspaceId,
        planId: "free",
      }
    );

    expect(
      await rows(
        "SELECT plan_id, status, provider, trial_ends_at FROM workspace_subscription WHERE workspace_id = ?",
        actor.workspaceId
      )
    ).toEqual([
      {
        plan_id: "free",
        status: "active",
        provider: "manual",
        trial_ends_at: null,
      },
    ]);
    expect(await auditTrail(actor.workspaceId)).toEqual([
      {
        action: "billing.plan_assigned",
        actor: admin.id,
        target: `workspace:${actor.workspaceId}`,
        metadata: { previousPlanId: null, planId: "pro", status: "trialing" },
      },
      {
        action: "billing.plan_assigned",
        actor: admin.id,
        target: `workspace:${actor.workspaceId}`,
        metadata: { previousPlanId: "pro", planId: "free", status: "active" },
      },
    ]);
  });

  it("refuses unknown plans and workspaces", async () => {
    const admin = await seedUser("Barbara Admin");
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-assign-bad" });
    await expect(
      assignPlan(
        billingDeps(),
        { userId: admin.id },
        {
          workspaceId: actor.workspaceId,
          planId: "platinum",
        }
      )
    ).rejects.toBeInstanceOf(UnknownCatalogKeyError);
    await expect(
      assignPlan(
        billingDeps(),
        { userId: admin.id },
        {
          workspaceId: actor.workspaceId,
          planId: "free",
          status: "trialing",
          trialEndsAt: "2026-12-01T00:00:00.000Z",
        }
      )
    ).rejects.toBeInstanceOf(TrialWithoutFallbackError);
    await expect(
      assignPlan(
        billingDeps(),
        { userId: admin.id },
        {
          workspaceId: "ws-missing",
          planId: "pro",
        }
      )
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });
});
