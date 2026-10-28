import { eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { WorkspaceNotFoundError, workspaces } from "../workspaces";
import { workspaceSubscription } from "./billing.schema";
import {
  type AssignPlanInput,
  assignPlanInputSchema,
  findPlan,
  MANUAL_PROVIDER,
  TrialWithoutFallbackError,
  UnknownCatalogKeyError,
} from "./domain";

/**
 * Platform admin: puts a workspace on a plan, active or trialing until `trialEndsAt`
 * (manual billing, or an exception in provider mode, where the provider's next event wins).
 * Keeps provider ids; a subscription without one becomes "manual". Records
 * `billing.plan_assigned`. The caller has checked that the user is a platform admin.
 */
export async function assignPlan(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  admin: { readonly userId: string },
  input: AssignPlanInput
): Promise<{ readonly planId: string; readonly status: string }> {
  const parsed = assignPlanInputSchema.parse(input);
  const plan = findPlan(parsed.planId);
  if (!plan) throw new UnknownCatalogKeyError("plan", parsed.planId);
  // A trial needs somewhere to lapse to; a plan that is its own fallback has none.
  if (parsed.status === "trialing" && plan.fallbackPlanId === plan.id)
    throw new TrialWithoutFallbackError(plan.id);

  const [[workspace], [current]] = await deps.db.batch([
    deps.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, parsed.workspaceId)),
    deps.db
      .select({ planId: workspaceSubscription.planId })
      .from(workspaceSubscription)
      .where(eq(workspaceSubscription.workspaceId, parsed.workspaceId)),
  ]);
  if (!workspace) throw new WorkspaceNotFoundError();

  const now = deps.clock.now();
  const values = {
    planId: parsed.planId,
    status: parsed.status,
    trialEndsAt: parsed.trialEndsAt ? new Date(parsed.trialEndsAt) : null,
    periodEnd: parsed.periodEnd ? new Date(parsed.periodEnd) : null,
    updatedAt: now,
  };
  await deps.db
    .insert(workspaceSubscription)
    .values({
      workspaceId: parsed.workspaceId,
      periodStart: now,
      provider: MANUAL_PROVIDER,
      ...values,
    })
    .onConflictDoUpdate({
      target: workspaceSubscription.workspaceId,
      set: values,
    });

  await recordAuditEvent(deps, deps.requestContext, {
    action: "billing.plan_assigned",
    actor: { kind: "admin", userId: admin.userId },
    workspaceId: parsed.workspaceId,
    target: { type: "workspace", id: parsed.workspaceId },
    metadata: {
      previousPlanId: current?.planId ?? null,
      planId: parsed.planId,
      status: parsed.status,
    },
  });
  return { planId: parsed.planId, status: parsed.status };
}
