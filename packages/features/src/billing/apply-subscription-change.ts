import { eq, lt } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { SubscriptionChange } from "../platform";
import { WorkspaceNotFoundError, workspaces } from "../workspaces";
import { workspaceAddon, workspaceSubscription } from "./billing.schema";
import {
  findAddon,
  findPlan,
  subscriptionChangeSchema,
  UnknownCatalogKeyError,
} from "./domain";

/**
 * Applies a provider's subscription event (normalized by its adapter's parseWebhook) to the
 * workspace: plan, status, period, trial and provider ids, and the add-ons when the event
 * names them. Events not newer than the stored state are ignored (also when two race:
 * the write is conditional), so redelivered and out-of-order webhooks are harmless. Records `billing.subscription_changed`.
 */
export async function applySubscriptionChange(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  change: SubscriptionChange
): Promise<{ readonly applied: boolean }> {
  const parsed = subscriptionChangeSchema.parse(change);
  if (!findPlan(parsed.planId))
    throw new UnknownCatalogKeyError("plan", parsed.planId);
  for (const addon of parsed.addons ?? []) {
    if (!findAddon(addon.addonId))
      throw new UnknownCatalogKeyError("addon", addon.addonId);
  }

  const [[workspace], [current]] = await deps.db.batch([
    deps.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, parsed.workspaceId)),
    deps.db
      .select({
        planId: workspaceSubscription.planId,
        updatedAt: workspaceSubscription.updatedAt,
      })
      .from(workspaceSubscription)
      .where(eq(workspaceSubscription.workspaceId, parsed.workspaceId)),
  ]);
  if (!workspace) throw new WorkspaceNotFoundError();
  if (current && current.updatedAt.getTime() >= parsed.occurredAt.getTime())
    return { applied: false };

  const values = {
    planId: parsed.planId,
    status: parsed.status,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    trialEndsAt: parsed.trialEndsAt,
    provider: parsed.provider,
    providerCustomerId: parsed.customerId,
    providerSubscriptionId: parsed.subscriptionId,
    // The event's time orders later events against this one.
    updatedAt: parsed.occurredAt,
  };
  // Conditional on the stored state being older, so two deliveries racing each other
  // cannot let the older event win, and a redelivery writes nothing.
  const written = await deps.db
    .insert(workspaceSubscription)
    .values({ workspaceId: parsed.workspaceId, ...values })
    .onConflictDoUpdate({
      target: workspaceSubscription.workspaceId,
      set: values,
      setWhere: lt(workspaceSubscription.updatedAt, parsed.occurredAt),
    })
    .returning({ workspaceId: workspaceSubscription.workspaceId });
  if (written.length === 0) return { applied: false };

  const addons = parsed.addons;
  if (addons) {
    await deps.db.batch([
      deps.db
        .delete(workspaceAddon)
        .where(eq(workspaceAddon.workspaceId, parsed.workspaceId)),
      ...addons.map((addon) =>
        deps.db
          .insert(workspaceAddon)
          .values({ workspaceId: parsed.workspaceId, ...addon })
      ),
    ]);
  }

  await recordAuditEvent(deps, deps.requestContext, {
    action: "billing.subscription_changed",
    actor: { kind: "system" },
    workspaceId: parsed.workspaceId,
    target: { type: "workspace", id: parsed.workspaceId },
    metadata: {
      previousPlanId: current?.planId ?? null,
      planId: parsed.planId,
      status: parsed.status,
      provider: parsed.provider,
    },
  });
  return { applied: true };
}
