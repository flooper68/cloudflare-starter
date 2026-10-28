import { asc, eq } from "drizzle-orm";

import type { Clock } from "../../../kernel";
import { createDb } from "../../db";
import type {
  FeatureFlagStore,
  FeatureFlags,
  FlagRule,
  FlagValue,
  StoredFlag,
  StoredFlagEntry,
} from "../../ports";
import {
  createStoredFlagProvider,
  type StoredFlags,
} from "../../stored-flag-provider";
import { featureFlagRules, featureFlags } from "./d1-feature-flags.schema";

/** How long an isolate serves flags from memory before it reads D1 again. */
export const D1_FLAGS_TTL_MS = 30_000;
/** After a failed load, evaluations return defaults without querying D1 for this long. */
export const D1_FLAGS_RETRY_MS = 5_000;

export interface D1FeatureFlagsOptions {
  readonly d1: D1Database;
  /** Drives the cache TTL; tests pass a clock they move by hand. */
  readonly clock: Clock;
  readonly ttlMs?: number;
  /**
   * Called when loading the flags fails (D1 down, tables missing), at most once per
   * retry window. Evaluations then return their defaults with reason ERROR / GENERAL.
   */
  readonly onLoadError?: (error: unknown) => void;
}

const schema = { featureFlags, featureFlagRules };

function parseValue(json: string): FlagValue {
  const value: unknown = JSON.parse(json);
  if (
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  throw new Error("not a boolean, string or number");
}

type FlagRow = typeof featureFlags.$inferSelect;
type RuleRow = typeof featureFlagRules.$inferSelect;

function toRule(row: RuleRow): FlagRule {
  const value = parseValue(row.valueJson);
  if (row.kind === "workspace" && row.workspaceId)
    return { kind: "workspace", workspaceId: row.workspaceId, value };
  if (row.kind === "plan" && row.planId)
    return { kind: "plan", planId: row.planId, value };
  if (
    row.kind === "percentage" &&
    row.percentageBp !== null &&
    row.percentageBp >= 0 &&
    row.percentageBp <= 10_000
  )
    return { kind: "percentage", percentageBp: row.percentageBp, value };
  throw new Error(`rule ${row.id} is incomplete`);
}

function toFlag(row: FlagRow, rules: readonly RuleRow[]): StoredFlag {
  return {
    key: row.key,
    enabled: row.enabled,
    fallthrough:
      row.fallthroughJson === null ? null : parseValue(row.fallthroughJson),
    rules: rules.map(toRule),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

/**
 * Feature-flag provider and store on D1 (`FEATURE_FLAGS=d1`). Loads every flag with its
 * rules in one query and serves them from memory for `ttlMs` (30 s) per isolate, measured
 * on the injected clock. Writes through this store clear the cache of this isolate at
 * once; other isolates pick a change up within the TTL. A flag whose stored JSON does not
 * parse evaluates to the default with PARSE_ERROR; a failed query to the default with
 * GENERAL (the port never throws), reported through `onLoadError` and not retried for
 * D1_FLAGS_RETRY_MS. Concurrent evaluations on a cold cache share one query.
 */
export function createD1FeatureFlags(
  options: D1FeatureFlagsOptions
): FeatureFlags & FeatureFlagStore {
  const db = createDb(options.d1, schema);
  const ttlMs = options.ttlMs ?? D1_FLAGS_TTL_MS;
  let cache: { readonly at: number; readonly flags: StoredFlags } | undefined;
  let inFlight: Promise<StoredFlags> | undefined;
  let failure: { readonly at: number; readonly error: unknown } | undefined;

  async function read(): Promise<StoredFlags> {
    const rows = await db
      .select({ flag: featureFlags, rule: featureFlagRules })
      .from(featureFlags)
      .leftJoin(
        featureFlagRules,
        eq(featureFlagRules.flagKey, featureFlags.key)
      )
      .orderBy(asc(featureFlags.key), asc(featureFlagRules.position));
    const grouped = new Map<string, { flag: FlagRow; rules: RuleRow[] }>();
    for (const { flag, rule } of rows) {
      const entry = grouped.get(flag.key) ?? { flag, rules: [] };
      if (rule) entry.rules.push(rule);
      grouped.set(flag.key, entry);
    }
    const flags = new Map<string, StoredFlagEntry>();
    for (const [key, { flag, rules }] of grouped) {
      try {
        flags.set(key, toFlag(flag, rules));
      } catch (error) {
        flags.set(key, {
          key,
          invalid: true,
          error: error instanceof Error ? error.message : String(error),
          updatedAt: flag.updatedAt.toISOString(),
          updatedBy: flag.updatedBy,
        });
      }
    }
    cache = { at: options.clock.now().getTime(), flags };
    return flags;
  }

  async function load(): Promise<StoredFlags> {
    const now = options.clock.now().getTime();
    if (cache && now - cache.at < ttlMs) return cache.flags;
    if (failure && now - failure.at < D1_FLAGS_RETRY_MS) throw failure.error;
    inFlight ??= read()
      .then((flags) => {
        failure = undefined;
        return flags;
      })
      .catch((error: unknown) => {
        failure = { at: options.clock.now().getTime(), error };
        options.onLoadError?.(error);
        throw error;
      })
      .finally(() => {
        inFlight = undefined;
      });
    return inFlight;
  }

  /**
   * The flag after a write. `repair` runs when it still does not parse, overwriting the
   * part the write did not (rules for update, fallthrough for setRules).
   */
  async function current(
    key: string,
    repair: () => Promise<unknown>
  ): Promise<StoredFlag> {
    cache = undefined;
    let flag = (await read()).get(key);
    if (flag && "invalid" in flag) {
      await repair();
      flag = (await read()).get(key);
    }
    if (!flag || "invalid" in flag)
      throw new Error(`Flag ${key} was not stored`);
    return flag;
  }

  return {
    ...createStoredFlagProvider(load),

    async list() {
      return [...(await read()).values()];
    },

    async update(key, change, actorUserId) {
      const updatedAt = options.clock.now();
      const fallthroughJson =
        change.fallthrough === null ? null : JSON.stringify(change.fallthrough);
      await db
        .insert(featureFlags)
        .values({
          key,
          enabled: change.enabled,
          fallthroughJson,
          updatedAt,
          updatedBy: actorUserId,
        })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: {
            enabled: change.enabled,
            fallthroughJson,
            updatedAt,
            updatedBy: actorUserId,
          },
        });
      // Rules that do not parse already made the flag resolve to its default: drop them.
      return current(key, () =>
        db.delete(featureFlagRules).where(eq(featureFlagRules.flagKey, key))
      );
    },

    async setRules(key, rules, actorUserId) {
      const updatedAt = options.clock.now();
      const upsertFlag = db
        .insert(featureFlags)
        .values({ key, enabled: false, updatedAt, updatedBy: actorUserId })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: { updatedAt, updatedBy: actorUserId },
        });
      const deleteRules = db
        .delete(featureFlagRules)
        .where(eq(featureFlagRules.flagKey, key));
      const rows = rules.map((rule, position) => ({
        id: `${key}:${position}`,
        flagKey: key,
        position,
        kind: rule.kind,
        workspaceId: rule.kind === "workspace" ? rule.workspaceId : null,
        planId: rule.kind === "plan" ? rule.planId : null,
        percentageBp: rule.kind === "percentage" ? rule.percentageBp : null,
        valueJson: JSON.stringify(rule.value),
      }));
      // One batch: D1 runs it as a single transaction.
      if (rows.length > 0) {
        await db.batch([
          upsertFlag,
          deleteRules,
          db.insert(featureFlagRules).values(rows),
        ]);
      } else {
        await db.batch([upsertFlag, deleteRules]);
      }
      // A fallthrough that does not parse is reset to the default.
      return current(key, () =>
        db
          .update(featureFlags)
          .set({ fallthroughJson: null })
          .where(eq(featureFlags.key, key))
      );
    },
  };
}
