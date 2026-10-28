import { RATE_LIMIT_POLICIES, type RateLimitPolicyId } from "./policies";

/** Who is making the request; either may be unknown. */
export interface LimitSubject {
  readonly userId: string | null;
  readonly ip: string | null;
}

/**
 * The counter key for a policy and a subject: `<policy>:user:<id>` for user-scoped
 * policies with a signed-in user, else `<policy>:ip:<ip>`. Anonymous callers of a
 * user-scoped policy are counted by IP; requests without a known IP share one counter.
 */
export function limitKey(
  policyId: RateLimitPolicyId,
  subject: LimitSubject
): string {
  const policy = RATE_LIMIT_POLICIES[policyId];
  if (policy.scope === "user" && subject.userId) {
    return `${policyId}:user:${subject.userId}`;
  }
  return `${policyId}:ip:${subject.ip ?? "unknown"}`;
}
