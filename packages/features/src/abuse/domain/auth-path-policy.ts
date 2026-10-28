import {
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
  type RateLimitPolicyId,
} from "./policies";

/**
 * The Better Auth policy that applies to a path under /api/auth (`/sign-in/email`), or
 * null. Patterns ending in `/*` match everything below them, like Better Auth's own rules.
 */
export function authPathPolicy(path: string): RateLimitPolicyId | null {
  const entries = Object.entries(RATE_LIMIT_POLICIES) as [
    RateLimitPolicyId,
    RateLimitPolicy,
  ][];
  for (const [id, policy] of entries) {
    const pattern = policy.authPath;
    if (policy.enforcer !== "better-auth" || !pattern) continue;
    const matches = pattern.endsWith("/*")
      ? path.startsWith(pattern.slice(0, -1))
      : path === pattern;
    if (matches) return id;
  }
  return null;
}
