import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { WorkspaceNotFoundError, workspaces } from "../workspaces";
import type { BillingSettings, Entitlements, Override } from "./domain";
import { resolveEntitlements } from "./resolve-entitlements";

export interface WorkspaceBilling {
  readonly workspaceId: string;
  readonly mode: BillingSettings["mode"];
  readonly planId: string;
  readonly status: string | null;
  readonly trialEndsAt: string | null;
  readonly periodEnd: string | null;
  readonly provider: string | null;
  readonly providerCustomerId: string | null;
  readonly addons: readonly {
    readonly addonId: string;
    readonly quantity: number;
  }[];
  readonly overrides: readonly Override[];
  readonly entitlements: Entitlements;
}

/**
 * Platform admin: a workspace's subscription, add-ons, overrides and the entitlements they
 * add up to. The caller has checked that the user is a platform admin.
 */
export async function getWorkspaceBilling(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly settings: BillingSettings;
  },
  input: { readonly workspaceId: string }
): Promise<WorkspaceBilling> {
  const [workspace] = await deps.db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId));
  if (!workspace) throw new WorkspaceNotFoundError();
  const resolved = await resolveEntitlements(deps, input.workspaceId);
  return {
    workspaceId: input.workspaceId,
    mode: resolved.mode,
    planId: resolved.planId,
    status: resolved.status,
    trialEndsAt: resolved.trialEndsAt?.toISOString() ?? null,
    periodEnd: resolved.periodEnd?.toISOString() ?? null,
    provider: resolved.provider,
    providerCustomerId: resolved.providerCustomerId,
    addons: resolved.addons,
    overrides: resolved.overrides,
    entitlements: resolved.entitlements,
  };
}
