// Health checks for uptime monitors and status pages: IETF health check response bodies,
// one probe per dependency, and the runner with its deadline.
// docs/guides/how-to-monitor-health.md
export {
  aggregateHealthStatus,
  bindingsOutcome,
  emailOutcome,
  HEALTH_CONTENT_TYPE,
  HEALTH_DETAIL_MAX_LENGTH,
  HEALTH_STATUSES,
  type HealthCheckEntry,
  type HealthCheckResult,
  type HealthComponentType,
  type HealthResponseBody,
  type HealthResponseInput,
  type HealthStatus,
  healthHttpStatus,
  healthResponseBody,
  latencyStatus,
  type ProbeOutcome,
} from "./domain";
export { probeBucket } from "./probe-bucket";
export { probeDatabase } from "./probe-database";
export { type HealthProbe, runHealthCheck } from "./run-health-check";
