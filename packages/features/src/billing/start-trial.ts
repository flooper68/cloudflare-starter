import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { workspaceSubscription } from "./billing.schema";
import {
  type BillingSettings,
  findPlan,
  MANUAL_PROVIDER,
  NEW_WORKSPACE_PLAN_ID,
  trialEndsAt,
} from "./domain";

/**
 * Puts a new workspace on the catalog's NEW_WORKSPACE_PLAN_ID: trialing until the plan's
 * trial ends, or active when it has none. Runs when a workspace is created (through the
 * BillingGate). Idempotent: a workspace that already has a subscription keeps it. Nothing
 * happens with BILLING=off.
 */
export async function startTrial(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly settings: BillingSettings;
  },
  workspaceId: string
): Promise<{ readonly started: boolean }> {
  if (deps.settings.mode === "off") return { started: false };
  const plan = findPlan(NEW_WORKSPACE_PLAN_ID);
  if (!plan)
    throw new Error(
      `NEW_WORKSPACE_PLAN_ID ${NEW_WORKSPACE_PLAN_ID} is not a plan`
    );
  const now = deps.clock.now();
  const endsAt = trialEndsAt(plan, now);

  const created = await deps.db
    .insert(workspaceSubscription)
    .values({
      workspaceId,
      planId: plan.id,
      status: endsAt ? "trialing" : "active",
      periodStart: now,
      trialEndsAt: endsAt,
      provider: MANUAL_PROVIDER,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ workspaceId: workspaceSubscription.workspaceId });
  if (created.length === 0) return { started: false };

  await recordAuditEvent(deps, deps.requestContext, {
    action: "billing.trial_started",
    workspaceId,
    target: { type: "workspace", id: workspaceId },
    metadata: {
      planId: plan.id,
      trialEndsAt: endsAt ? endsAt.toISOString() : null,
    },
  });
  return { started: true };
}
