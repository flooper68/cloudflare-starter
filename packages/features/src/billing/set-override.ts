import { and, eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { WorkspaceNotFoundError, workspaces } from "../workspaces";
import { entitlementOverride } from "./billing.schema";
import {
  isFeatureKey,
  isMetricKey,
  type SetOverrideInput,
  setOverrideInputSchema,
  UnknownCatalogKeyError,
} from "./domain";

/**
 * Platform admin: an exception for one workspace that wins over its plan and add-ons:
 * grant or revoke a feature, or set a metric's limit (null is unlimited); `override: null`
 * removes it. Records `billing.override_set` with the reason. The caller has checked that
 * the user is a platform admin.
 */
export async function setOverride(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  admin: { readonly userId: string },
  input: SetOverrideInput
): Promise<{ readonly key: string; readonly removed: boolean }> {
  const parsed = setOverrideInputSchema.parse(input);
  const override = parsed.override;
  if (override?.kind === "feature" && !isFeatureKey(parsed.key))
    throw new UnknownCatalogKeyError("feature", parsed.key);
  if (override?.kind === "limit" && !isMetricKey(parsed.key))
    throw new UnknownCatalogKeyError("metric", parsed.key);

  const [workspace] = await deps.db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, parsed.workspaceId));
  if (!workspace) throw new WorkspaceNotFoundError();

  if (!override) {
    await deps.db
      .delete(entitlementOverride)
      .where(
        and(
          eq(entitlementOverride.workspaceId, parsed.workspaceId),
          eq(entitlementOverride.key, parsed.key)
        )
      );
  } else {
    const values = {
      kind: override.kind,
      enabled: override.kind === "feature" ? override.enabled : null,
      limit: override.kind === "limit" ? override.limit : null,
      reason: parsed.reason,
      createdBy: admin.userId,
      createdAt: deps.clock.now(),
    };
    await deps.db
      .insert(entitlementOverride)
      .values({ workspaceId: parsed.workspaceId, key: parsed.key, ...values })
      .onConflictDoUpdate({
        target: [entitlementOverride.workspaceId, entitlementOverride.key],
        set: values,
      });
  }

  await recordAuditEvent(deps, deps.requestContext, {
    action: "billing.override_set",
    actor: { kind: "admin", userId: admin.userId },
    workspaceId: parsed.workspaceId,
    target: { type: "workspace", id: parsed.workspaceId },
    metadata: {
      key: parsed.key,
      kind: override?.kind ?? "removed",
      ...(override?.kind === "feature" ? { enabled: override.enabled } : {}),
      ...(override?.kind === "limit" ? { limit: override.limit } : {}),
      reason: parsed.reason,
    },
  });
  return { key: parsed.key, removed: !override };
}
