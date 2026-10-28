import type {
  FeatureFlagStore,
  InvalidStoredFlag,
  StoredFlag,
} from "../platform";
import {
  FLAGS,
  type FlagDefinition,
  type FlagKey,
  FlagStoreUnavailableError,
} from "./domain";

export type FlagOverview = FlagDefinition & {
  readonly key: FlagKey;
  /**
   * What the store holds for the flag: its configuration, `{ invalid: true, error }` when
   * the stored data does not parse (it then resolves to its default; update or setRules
   * overwrites it), or null until an admin configures it.
   */
  readonly stored:
    | Omit<StoredFlag, "key">
    | Omit<InvalidStoredFlag, "key">
    | null;
};

/** Every catalog flag with its stored configuration, for the admin tools. */
export async function listFlags(deps: {
  readonly flagStore: FeatureFlagStore | null;
}): Promise<readonly FlagOverview[]> {
  if (!deps.flagStore) throw new FlagStoreUnavailableError();
  const stored = new Map(
    (await deps.flagStore.list()).map((flag) => [flag.key, flag])
  );
  return (Object.keys(FLAGS) as FlagKey[]).map((key) => {
    const flag = stored.get(key);
    return {
      key,
      ...(FLAGS[key] as FlagDefinition),
      stored: !flag
        ? null
        : "invalid" in flag
          ? {
              invalid: true,
              error: flag.error,
              updatedAt: flag.updatedAt,
              updatedBy: flag.updatedBy,
            }
          : {
              enabled: flag.enabled,
              fallthrough: flag.fallthrough,
              rules: flag.rules,
              updatedAt: flag.updatedAt,
              updatedBy: flag.updatedBy,
            },
    };
  });
}
