import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { FeatureFlagStore, StoredFlag } from "../platform";
import {
  assertFlagValueType,
  type FlagRuleInput,
  FlagStoreUnavailableError,
  requireFlagDefinition,
} from "./domain";

/**
 * Replaces a catalog flag's targeting rules with `rules`, in order (the first match
 * wins), then records `feature_flag.rules_changed`. Every rule value must have the flag's
 * catalog type. Creates the flag's stored configuration, switched off, when it has none.
 */
export async function setFlagRules(
  deps: {
    readonly flagStore: FeatureFlagStore | null;
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: {
    readonly key: string;
    readonly rules: readonly FlagRuleInput[];
    readonly actorUserId: string;
  }
): Promise<StoredFlag> {
  if (!deps.flagStore) throw new FlagStoreUnavailableError();
  const definition = requireFlagDefinition(input.key);
  for (const rule of input.rules)
    assertFlagValueType(input.key, definition, rule.value);
  const stored = await deps.flagStore.setRules(
    input.key,
    input.rules,
    input.actorUserId
  );
  // Platform configuration: not about one workspace. Rule targets stay out of the log.
  await recordAuditEvent(deps, deps.requestContext, {
    action: "feature_flag.rules_changed",
    actor: { kind: "admin", userId: input.actorUserId },
    workspaceId: null,
    target: { type: "feature_flag", id: input.key },
    metadata: {
      ruleCount: stored.rules.length,
      ruleKinds: stored.rules.map((rule) => rule.kind),
    },
  });
  return stored;
}
