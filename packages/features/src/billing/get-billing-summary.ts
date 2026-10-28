import type { Database } from "../database";
import type { Clock } from "../kernel";
import { type Actor, requirePermission } from "../workspaces";
import { type BillingSettings, findPlan } from "./domain";
import { getUsageSummary, type UsageSummary } from "./get-usage-summary";
import { resolveEntitlements } from "./resolve-entitlements";

export interface BillingSummary {
  readonly mode: BillingSettings["mode"];
  readonly planId: string;
  readonly planName: string;
  readonly status: string | null;
  readonly trialEndsAt: string | null;
  readonly periodEnd: string | null;
  readonly features: readonly string[];
  readonly addons: readonly {
    readonly addonId: string;
    readonly quantity: number;
  }[];
  readonly usage: UsageSummary;
}

/**
 * The actor's workspace's plan, status, features, add-ons and usage against its limits,
 * for members (`billing.read`).
 */
export async function getBillingSummary(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly settings: BillingSettings;
  },
  actor: Actor
): Promise<BillingSummary> {
  requirePermission(actor, "billing.read");
  const [resolved, usage] = await Promise.all([
    resolveEntitlements(deps, actor.workspaceId),
    getUsageSummary(deps, actor.workspaceId),
  ]);
  return {
    mode: resolved.mode,
    planId: resolved.planId,
    planName: findPlan(resolved.planId)?.name ?? resolved.planId,
    status: resolved.status,
    trialEndsAt: resolved.trialEndsAt?.toISOString() ?? null,
    periodEnd: resolved.periodEnd?.toISOString() ?? null,
    features: resolved.entitlements.features,
    addons: resolved.addons,
    usage,
  };
}
