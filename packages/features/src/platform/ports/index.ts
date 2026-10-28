// Ports: the interfaces app code and features depend on for outside services. Adapters in
// platform/adapters/<vendor>/ implement them; apps/web/src/server/platform.ts picks one.
// The contract suites (*.contract.ts) are test support and stay out of this barrel.
export type { ErrorReporter } from "./error-reporter";
export type {
  FeatureFlagStore,
  FeatureFlags,
  FlagContext,
  FlagDetails,
  FlagErrorCode,
  FlagReason,
  FlagRule,
  FlagValue,
  FlagValueType,
  InvalidStoredFlag,
  StoredFlag,
  StoredFlagEntry,
} from "./feature-flags";
export type {
  HumanVerificationFailure,
  HumanVerificationInput,
  HumanVerificationResult,
  HumanVerifier,
} from "./human-verifier";
export type { JobQueue, JobQueueSendOptions } from "./job-queue";
export type { LogFields, Logger, LogLevel } from "./logger";
export type {
  Counter,
  Histogram,
  Metrics,
  UpDownCounter,
} from "./metrics";
export type {
  AnalyticsContext,
  IdentifyTraits,
  ProductAnalytics,
  TrackedEvent,
} from "./product-analytics";
export type {
  RateLimiter,
  RateLimitResult,
  RateLimitRule,
} from "./rate-limiter";
export type {
  Span,
  SpanAttributes,
  SpanAttributeValue,
  SpanStatus,
  Tracer,
} from "./tracer";
