import { evaluateStoredFlag } from "./flag-evaluation";
import type {
  FeatureFlags,
  FlagContext,
  FlagDetails,
  FlagValue,
  FlagValueType,
  StoredFlagEntry,
} from "./ports";

/** Stored configuration by key, flags whose stored data did not parse included. */
export type StoredFlags = ReadonlyMap<string, StoredFlagEntry>;

/**
 * A FeatureFlags provider over a function that loads the stored configuration (the D1 and
 * memory adapters). Never throws: a failed load returns the default with reason ERROR and
 * error code GENERAL (PROVIDER_NOT_READY is for providers that need initialisation); a
 * flag whose stored data does not parse returns the default with PARSE_ERROR.
 */
export function createStoredFlagProvider(
  load: () => Promise<StoredFlags>
): FeatureFlags {
  async function details<T extends FlagValue>(
    type: FlagValueType,
    key: string,
    defaultValue: T,
    context: FlagContext
  ): Promise<FlagDetails<T>> {
    try {
      const flag = (await load()).get(key);
      if (flag && "invalid" in flag) {
        return {
          flagKey: key,
          value: defaultValue,
          reason: "ERROR",
          errorCode: "PARSE_ERROR",
          errorMessage: `Flag ${key} has a stored configuration that does not parse: ${flag.error}`,
          flagMetadata: {},
        };
      }
      return evaluateStoredFlag(flag, type, key, defaultValue, context);
    } catch (error) {
      return {
        flagKey: key,
        value: defaultValue,
        reason: "ERROR",
        errorCode: "GENERAL",
        errorMessage:
          error instanceof Error ? error.message : "Flag provider failed",
        flagMetadata: {},
      };
    }
  }
  return {
    getBooleanDetails: (key, defaultValue, context) =>
      details("boolean", key, defaultValue, context),
    getStringDetails: (key, defaultValue, context) =>
      details("string", key, defaultValue, context),
    getNumberDetails: (key, defaultValue, context) =>
      details("number", key, defaultValue, context),
  };
}
