import type { Database } from "../database";
import type { BillingGate, Clock, Ids, RequestContext } from "../kernel";
import { assertFeature } from "./assert-feature";
import { assertLimit } from "./assert-limit";
import type { BillingSettings } from "./domain";
import { recordUsage } from "./record-usage";
import { resolveEntitlements } from "./resolve-entitlements";
import { startTrial } from "./start-trial";

/**
 * The BillingGate other features' use cases receive as `deps.billing`: entitlement checks,
 * usage counting and the new-workspace hook, bound to this request's database, clock,
 * context and BILLING setting. Built once per request by the adapters.
 */
export function createBillingGate(deps: {
  readonly db: Database;
  readonly clock: Clock;
  readonly ids: Ids;
  readonly requestContext: RequestContext;
  readonly settings: BillingSettings;
}): BillingGate {
  return {
    requireFeature: (workspaceId, feature) =>
      assertFeature(deps, workspaceId, feature),
    requireLimit: (workspaceId, metric, increment) =>
      assertLimit(deps, workspaceId, metric, increment),
    recordUsage: (workspaceId, metric, amount) =>
      recordUsage(deps, workspaceId, metric, amount),
    workspaceCreated: async (workspaceId) => {
      await startTrial(deps, workspaceId);
    },
    planId: async (workspaceId) =>
      (await resolveEntitlements(deps, workspaceId)).planId,
  };
}
