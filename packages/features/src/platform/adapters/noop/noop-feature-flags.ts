import type { FeatureFlags, FlagDetails, FlagValue } from "../../ports";

function fallback<T extends FlagValue>(
  flagKey: string,
  value: T
): Promise<FlagDetails<T>> {
  return Promise.resolve({
    flagKey,
    value,
    variant: "default",
    reason: "DEFAULT",
    flagMetadata: {},
  });
}

/**
 * Flags off (`FEATURE_FLAGS=none`): every flag resolves to the default the caller passes,
 * which is the catalog default. No store: admin procedures report it is not configured.
 */
export const noopFeatureFlags: FeatureFlags = {
  getBooleanDetails: (key, defaultValue) => fallback(key, defaultValue),
  getStringDetails: (key, defaultValue) => fallback(key, defaultValue),
  getNumberDetails: (key, defaultValue) => fallback(key, defaultValue),
};
