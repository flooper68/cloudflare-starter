/**
 * Pure evaluation of a stored flag configuration, shared by the providers that keep their
 * own configuration (D1, memory). Vendor providers evaluate on their side. No I/O.
 */
import type {
  FlagContext,
  FlagDetails,
  FlagValue,
  FlagValueType,
  StoredFlag,
} from "./ports";

/** Buckets of a percentage rollout: basis points, so 1 bucket is 0.01 %. */
export const FLAG_BUCKETS = 10_000;

/** FNV-1a, 32 bit, over the UTF-16 code units of `text`. */
function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * The bucket (0–9999) of a targeting key for one flag. Stable across isolates, deploys and
 * providers; salted with the flag key so two rollouts at 10 % do not hit the same ids.
 */
export function flagBucket(flagKey: string, targetingKey: string): number {
  return fnv1a32(`${flagKey}:${targetingKey}`) % FLAG_BUCKETS;
}

function ofType<T extends FlagValue>(
  value: FlagValue,
  type: FlagValueType
): value is T {
  return typeof value === type;
}

/**
 * Evaluates `flag` (undefined when the provider has no configuration for the key) for one
 * context, in OpenFeature terms:
 * - no configuration: the default, ERROR / FLAG_NOT_FOUND;
 * - disabled: the default, DISABLED;
 * - the first matching rule in order: TARGETING_MATCH (workspace, plan) or SPLIT
 *   (percentage, which never matches without a targeting key);
 * - otherwise the fallthrough value: STATIC when the flag has no rules, DEFAULT when rules
 *   exist but none matched; the default when no fallthrough is set;
 * - a configured value of another type than requested: the default, ERROR / TYPE_MISMATCH.
 */
export function evaluateStoredFlag<T extends FlagValue>(
  flag: StoredFlag | undefined,
  type: FlagValueType,
  key: string,
  defaultValue: T,
  context: FlagContext
): FlagDetails<T> {
  if (!flag) {
    return {
      flagKey: key,
      value: defaultValue,
      reason: "ERROR",
      errorCode: "FLAG_NOT_FOUND",
      errorMessage: `Flag ${key} has no configuration`,
      flagMetadata: {},
    };
  }
  if (!flag.enabled) {
    return {
      flagKey: key,
      value: defaultValue,
      variant: "disabled",
      reason: "DISABLED",
      flagMetadata: {},
    };
  }
  const mismatch = (value: FlagValue): FlagDetails<T> => ({
    flagKey: key,
    value: defaultValue,
    reason: "ERROR",
    errorCode: "TYPE_MISMATCH",
    errorMessage: `Flag ${key} is configured with a ${typeof value}, requested as ${type}`,
    flagMetadata: {},
  });

  for (const [index, rule] of flag.rules.entries()) {
    let matched = false;
    const metadata: Record<string, string | number> = {
      ruleIndex: index,
      ruleKind: rule.kind,
    };
    if (rule.kind === "workspace") {
      matched = context.workspaceId === rule.workspaceId;
    } else if (rule.kind === "plan") {
      matched = context.plan !== null && context.plan === rule.planId;
    } else if (context.targetingKey) {
      const bucket = flagBucket(key, context.targetingKey);
      metadata.bucket = bucket;
      matched = bucket < rule.percentageBp;
    }
    if (!matched) continue;
    if (!ofType<T>(rule.value, type)) return mismatch(rule.value);
    return {
      flagKey: key,
      value: rule.value,
      variant: `rule-${index}`,
      reason: rule.kind === "percentage" ? "SPLIT" : "TARGETING_MATCH",
      flagMetadata: metadata,
    };
  }

  if (flag.fallthrough === null) {
    return {
      flagKey: key,
      value: defaultValue,
      variant: "default",
      reason: "DEFAULT",
      flagMetadata: {},
    };
  }
  if (!ofType<T>(flag.fallthrough, type)) return mismatch(flag.fallthrough);
  return {
    flagKey: key,
    value: flag.fallthrough,
    variant: "fallthrough",
    reason: flag.rules.length === 0 ? "STATIC" : "DEFAULT",
    flagMetadata: {},
  };
}
