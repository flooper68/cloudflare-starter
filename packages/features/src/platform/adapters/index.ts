// Adapters of the platform ports, one folder per vendor (cloudflare) plus noop and memory.
// JobQueue has no noop adapter on purpose (see ports/job-queue.ts).
// Vendor SDKs may be imported only inside their own folder (dependency-cruiser rule
// vendor-sdks-only-in-adapters).
export {
  ANALYTICS_ENGINE_FIXED_BLOBS,
  type AnalyticsEngineProductAnalyticsOptions,
  createAnalyticsEngineProductAnalytics,
  createCloudflareJobQueue,
  createCloudflareRateLimiter,
  createD1FeatureFlags,
  createTurnstileVerifier,
  createWorkersLogsErrorReporter,
  createWorkersLogsLogger,
  D1_FLAGS_TTL_MS,
  type D1FeatureFlagsOptions,
  type DecodedAnalyticsDataPoint,
  decodeAnalyticsEngineDataPoint,
  ERROR_REPORT_EVENT,
  pseudonymousId,
  SITEVERIFY_URL,
  type TurnstileVerifierConfig,
  toAnalyticsEngineDataPoint,
  type WorkersLogsLoggerOptions,
} from "./cloudflare";
export {
  type CapturedError,
  createMemoryErrorReporter,
  createMemoryFeatureFlags,
  createMemoryHumanVerifier,
  createMemoryJobQueue,
  createMemoryLogger,
  createMemoryProductAnalytics,
  createMemoryRateLimiter,
  type MemoryErrorReporter,
  type MemoryFeatureFlags,
  type MemoryJobQueue,
  type MemoryLogger,
  type MemoryProductAnalytics,
  type RecordedAnalytics,
  type SentJob,
} from "./memory";
export {
  noopErrorReporter,
  noopFeatureFlags,
  noopHumanVerifier,
  noopLogger,
  noopProductAnalytics,
  noopRateLimiter,
} from "./noop";
