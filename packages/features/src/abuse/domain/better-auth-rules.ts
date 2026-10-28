import type { RateLimitPolicy } from "./policies";

export interface BetterAuthRule {
  readonly window: number;
  readonly max: number;
}

/** Better Auth `rateLimit.customRules` built from the catalog's better-auth policies. */
export function betterAuthRules(
  policies: Readonly<Record<string, RateLimitPolicy>>
): Record<string, BetterAuthRule> {
  const rules: Record<string, BetterAuthRule> = {};
  for (const policy of Object.values(policies)) {
    if (policy.enforcer !== "better-auth" || !policy.authPath) continue;
    rules[policy.authPath] = {
      window: policy.periodSeconds,
      max: policy.limit,
    };
  }
  return rules;
}
