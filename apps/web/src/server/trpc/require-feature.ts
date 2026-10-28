import { TRPCError } from "@trpc/server";

import { type FeatureConfig, getFeatureError } from "@/lib/config";

/** The configured optional service (email, R2), or PRECONDITION_FAILED naming what is missing. */
export function requireFeature<T>(feature: FeatureConfig<T>): T {
  if (!feature.enabled || feature.value === null) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: getFeatureError(feature.reason),
    });
  }
  return feature.value;
}
