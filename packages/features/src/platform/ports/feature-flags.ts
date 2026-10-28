/**
 * Port: feature flags, shaped like the OpenFeature evaluation API
 * (https://openfeature.dev/specification/types): `get{Boolean,String,Number}Details` return
 * the evaluation details (value, variant, reason, error code, flag metadata) and never
 * throw. A provider that fails returns the caller's default with reason ERROR.
 *
 * Features never call this port directly: they call `evaluateFlag(flags, key, subject)` in
 * packages/features/src/feature-flags, which takes the type and default from the catalog.
 * Implementations live in platform/adapters/<vendor>/ and pass
 * `describeFeatureFlagsContract` (feature-flags.contract.ts).
 */

/** The value types this app's flags may have (OpenFeature also has structures; unused). */
export type FlagValue = boolean | string | number;
export type FlagValueType = "boolean" | "string" | "number";

/** OpenFeature resolution reasons. */
export type FlagReason =
  | "STATIC"
  | "DEFAULT"
  | "TARGETING_MATCH"
  | "SPLIT"
  | "CACHED"
  | "DISABLED"
  | "UNKNOWN"
  | "STALE"
  | "ERROR";

/** OpenFeature error codes. */
export type FlagErrorCode =
  | "PROVIDER_NOT_READY"
  | "FLAG_NOT_FOUND"
  | "PARSE_ERROR"
  | "TYPE_MISMATCH"
  | "TARGETING_KEY_MISSING"
  | "INVALID_CONTEXT"
  | "PROVIDER_FATAL"
  | "GENERAL";

/** OpenFeature evaluation details. */
export interface FlagDetails<T extends FlagValue> {
  readonly flagKey: string;
  readonly value: T;
  readonly variant?: string;
  readonly reason: FlagReason;
  readonly errorCode?: FlagErrorCode;
  readonly errorMessage?: string;
  readonly flagMetadata: Readonly<Record<string, boolean | string | number>>;
}

/**
 * OpenFeature evaluation context. `targetingKey` is the id percentage rollouts bucket by
 * (a workspace or a user id, per the flag's `rolloutBy`); null when there is none, and then
 * no percentage rule matches. `plan` stays null until plans exist.
 */
export interface FlagContext {
  readonly targetingKey: string | null;
  readonly userId: string | null;
  readonly workspaceId: string | null;
  readonly plan: string | null;
  readonly environment: string;
}

export interface FeatureFlags {
  getBooleanDetails(
    key: string,
    defaultValue: boolean,
    context: FlagContext
  ): Promise<FlagDetails<boolean>>;
  getStringDetails(
    key: string,
    defaultValue: string,
    context: FlagContext
  ): Promise<FlagDetails<string>>;
  getNumberDetails(
    key: string,
    defaultValue: number,
    context: FlagContext
  ): Promise<FlagDetails<number>>;
}

/**
 * One targeting rule, evaluated in order; the first that matches decides the value.
 * `percentageBp` is in basis points (0–10000): the rule matches when the context's bucket
 * (FNV-1a 32 of `${key}:${targetingKey}` mod 10000) is below it.
 */
export type FlagRule =
  | {
      readonly kind: "workspace";
      readonly workspaceId: string;
      readonly value: FlagValue;
    }
  | {
      readonly kind: "plan";
      readonly planId: string;
      readonly value: FlagValue;
    }
  | {
      readonly kind: "percentage";
      readonly percentageBp: number;
      readonly value: FlagValue;
    };

/** A flag's stored configuration, as a provider with its own store keeps it. */
export interface StoredFlag {
  readonly key: string;
  readonly enabled: boolean;
  /** The value when no rule matches; null means the caller's (catalog) default. */
  readonly fallthrough: FlagValue | null;
  readonly rules: readonly FlagRule[];
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

/**
 * A stored flag whose data does not parse (hand-written SQL, for example). It evaluates to
 * the caller's default with PARSE_ERROR; `update` and `setRules` overwrite it.
 */
export interface InvalidStoredFlag {
  readonly key: string;
  readonly invalid: true;
  /** Why it does not parse, safe to show to admins. */
  readonly error: string;
  readonly updatedAt: string;
  readonly updatedBy: string | null;
}

/** What a store holds for one key: a usable configuration, or one that does not parse. */
export type StoredFlagEntry = StoredFlag | InvalidStoredFlag;

/**
 * Management side of a provider that stores flag configuration itself (the D1 provider).
 * Vendor providers (LaunchDarkly, PostHog) are managed in the vendor's UI and have none.
 * Writes take effect in this isolate at once; other isolates see them within their cache
 * TTL.
 */
export interface FeatureFlagStore {
  /** Every stored flag, the ones whose data does not parse included. */
  list(): Promise<readonly StoredFlagEntry[]>;
  /**
   * Creates the flag's row when it has none (with no rules). Rules that do not parse are
   * dropped: they already made the whole flag resolve to its default.
   */
  update(
    key: string,
    change: {
      readonly enabled: boolean;
      readonly fallthrough: FlagValue | null;
    },
    actorUserId: string
  ): Promise<StoredFlag>;
  /**
   * Replaces the flag's rules, in order. Creates the row (disabled) when it has none. A
   * fallthrough that does not parse is reset to null (the default).
   */
  setRules(
    key: string,
    rules: readonly FlagRule[],
    actorUserId: string
  ): Promise<StoredFlag>;
}
