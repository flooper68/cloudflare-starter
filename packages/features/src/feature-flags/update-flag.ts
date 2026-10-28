import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { FeatureFlagStore, StoredFlag } from "../platform";
import {
  assertFlagValueType,
  FlagStoreUnavailableError,
  requireFlagDefinition,
} from "./domain";

/**
 * Turns a catalog flag on or off and sets its fallthrough value (null: the catalog
 * default), then records `feature_flag.updated`. Takes effect in this isolate at once,
 * elsewhere within the provider's cache TTL (30 s for D1).
 */
export async function updateFlag(
  deps: {
    readonly flagStore: FeatureFlagStore | null;
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: {
    readonly key: string;
    readonly enabled: boolean;
    readonly fallthrough: boolean | string | number | null;
    readonly actorUserId: string;
  }
): Promise<StoredFlag> {
  if (!deps.flagStore) throw new FlagStoreUnavailableError();
  const definition = requireFlagDefinition(input.key);
  assertFlagValueType(input.key, definition, input.fallthrough);
  const stored = await deps.flagStore.update(
    input.key,
    { enabled: input.enabled, fallthrough: input.fallthrough },
    input.actorUserId
  );
  // Platform configuration: not about one workspace.
  await recordAuditEvent(deps, deps.requestContext, {
    action: "feature_flag.updated",
    actor: { kind: "admin", userId: input.actorUserId },
    workspaceId: null,
    target: { type: "feature_flag", id: input.key },
    metadata: { enabled: stored.enabled, fallthrough: stored.fallthrough },
  });
  return stored;
}
