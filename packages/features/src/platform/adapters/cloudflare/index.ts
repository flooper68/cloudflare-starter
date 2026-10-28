// Cloudflare adapters: the vendor code for Cloudflare-native services lives only here.

export {
  ANALYTICS_ENGINE_LAYOUT,
  type AnalyticsEngineMetricsOptions,
  createAnalyticsEngineMetrics,
  fromDataPoint,
  MAX_POINTS_PER_FLUSH,
  toDataPoint,
} from "./analytics-engine-metrics";
export {
  type CloudflareEmailConfig,
  createCloudflareEmail,
} from "./cloudflare-email";
export { createCloudflareJobQueue } from "./cloudflare-job-queue";
export {
  createD1FeatureFlags,
  D1_FLAGS_TTL_MS,
  type D1FeatureFlagsOptions,
} from "./d1-feature-flags";
export {
  createTurnstileVerifier,
  SITEVERIFY_URL,
  type TurnstileVerifierConfig,
} from "./turnstile-human-verifier";
export {
  createWorkersLogsErrorReporter,
  ERROR_REPORT_EVENT,
} from "./workers-logs-error-reporter";
export {
  createWorkersLogsLogger,
  type WorkersLogsLoggerOptions,
} from "./workers-logs-logger";
export { createCloudflareRateLimiter } from "./workers-rate-limiter";
export {
  createWorkersTracer,
  type WorkersTracerOptions,
} from "./workers-tracer";
