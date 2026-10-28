// In-memory adapters for tests: they record what the app sent so tests can assert on it.
export {
  type CapturedError,
  createMemoryErrorReporter,
  type MemoryErrorReporter,
} from "./memory-error-reporter";
export {
  createMemoryFeatureFlags,
  type MemoryFeatureFlags,
} from "./memory-feature-flags";
export { createMemoryHumanVerifier } from "./memory-human-verifier";
export {
  createMemoryJobQueue,
  type MemoryJobQueue,
  type SentJob,
} from "./memory-job-queue";
export { createMemoryLogger, type MemoryLogger } from "./memory-logger";
export {
  createMemoryProductAnalytics,
  type MemoryProductAnalytics,
  type RecordedAnalytics,
} from "./memory-product-analytics";
export { createMemoryRateLimiter } from "./memory-rate-limiter";
