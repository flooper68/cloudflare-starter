// Adapters of the platform ports, one folder per vendor (cloudflare) plus noop and memory.
// JobQueue has no noop adapter on purpose (see ports/job-queue.ts).
// Vendor SDKs may be imported only inside their own folder (dependency-cruiser rule
// vendor-sdks-only-in-adapters).
export {
  createCloudflareJobQueue,
  createD1FeatureFlags,
  createWorkersLogsErrorReporter,
  createWorkersLogsLogger,
  D1_FLAGS_TTL_MS,
  type D1FeatureFlagsOptions,
  ERROR_REPORT_EVENT,
  type WorkersLogsLoggerOptions,
} from "./cloudflare";
export {
  type CapturedError,
  createMemoryErrorReporter,
  createMemoryFeatureFlags,
  createMemoryJobQueue,
  createMemoryLogger,
  type MemoryErrorReporter,
  type MemoryFeatureFlags,
  type MemoryJobQueue,
  type MemoryLogger,
  type SentJob,
} from "./memory";
export { noopErrorReporter, noopFeatureFlags, noopLogger } from "./noop";
