// Abuse protection: the rate-limit catalog, its keys, its error and the use case that
// enforces a policy. The limiters and the human check are platform ports (platform/ports/).
export {
  authPathPolicy,
  type BetterAuthRule,
  betterAuthRules,
  DEFAULT_MUTATION_POLICY,
  EDGE_PERIODS,
  HumanCheckFailedError,
  HumanCheckUnavailableError,
  type LimitSubject,
  limitKey,
  mutationPolicy,
  PROCEDURE_POLICIES,
  RATE_LIMIT_EXEMPT,
  RATE_LIMIT_POLICIES,
  type RateLimitEnforcer,
  RateLimitedError,
  type RateLimitPolicy,
  type RateLimitPolicyId,
  type RateLimitScope,
  ROUTE_POLICIES,
} from "./domain";
export { enforceRateLimit } from "./enforce-rate-limit";
export { type HumanCheckFailure, verifyHuman } from "./verify-human";
