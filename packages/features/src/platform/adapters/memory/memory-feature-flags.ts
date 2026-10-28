import type { Clock } from "../../../kernel";
import type {
  FeatureFlagStore,
  FeatureFlags,
  FlagRule,
  FlagValue,
  StoredFlag,
  StoredFlagEntry,
} from "../../ports";
import { createStoredFlagProvider } from "../../stored-flag-provider";

/** Flags kept in memory, evaluated like the D1 provider. For tests. */
export interface MemoryFeatureFlags extends FeatureFlags, FeatureFlagStore {
  /** The stored configuration, by key. */
  readonly flags: ReadonlyMap<string, StoredFlagEntry>;
}

const FIXED_CLOCK: Clock = { now: () => new Date("2026-10-28T12:00:00.000Z") };

/** A provider and store in memory; seed it with `initial` or through the store methods. */
export function createMemoryFeatureFlags(
  options: {
    /** Seed data; an InvalidStoredFlag stands for a row whose data does not parse. */
    readonly initial?: readonly StoredFlagEntry[];
    readonly clock?: Clock;
  } = {}
): MemoryFeatureFlags {
  const clock = options.clock ?? FIXED_CLOCK;
  const flags = new Map<string, StoredFlagEntry>(
    (options.initial ?? []).map((flag) => [flag.key, flag])
  );
  const provider = createStoredFlagProvider(async () => flags);

  function save(
    key: string,
    change: Partial<Pick<StoredFlag, "enabled" | "fallthrough" | "rules">>,
    actorUserId: string
  ): StoredFlag {
    const entry = flags.get(key);
    // An entry that does not parse is overwritten, as the D1 store does.
    const current = entry && !("invalid" in entry) ? entry : undefined;
    const next: StoredFlag = {
      key,
      enabled: change.enabled ?? current?.enabled ?? false,
      fallthrough:
        change.fallthrough !== undefined
          ? change.fallthrough
          : (current?.fallthrough ?? null),
      rules: change.rules ?? current?.rules ?? [],
      updatedAt: clock.now().toISOString(),
      updatedBy: actorUserId,
    };
    flags.set(key, next);
    return next;
  }

  return {
    ...provider,
    flags,
    list: async () =>
      [...flags.values()].sort((a, b) => a.key.localeCompare(b.key)),
    update: async (
      key: string,
      change: { enabled: boolean; fallthrough: FlagValue | null },
      actorUserId: string
    ) => save(key, change, actorUserId),
    setRules: async (
      key: string,
      rules: readonly FlagRule[],
      actorUserId: string
    ) => save(key, { rules }, actorUserId),
  };
}
