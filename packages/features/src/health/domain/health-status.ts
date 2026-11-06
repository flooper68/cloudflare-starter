/**
 * Health statuses as the IETF health check response format defines them
 * (draft-inadarei-api-health-check): `pass` healthy, `warn` healthy with concerns, `fail`
 * unhealthy. docs/guides/how-to-monitor-health.md.
 */
export const HEALTH_STATUSES = ["pass", "warn", "fail"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

/** The media type of a health check response. */
export const HEALTH_CONTENT_TYPE = "application/health+json";

/**
 * The overall status of several checks: `fail` if any failed, else `warn` if any warned,
 * else `pass` (also for no checks at all).
 */
export function aggregateHealthStatus(
  statuses: readonly HealthStatus[]
): HealthStatus {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "pass";
}

/**
 * The HTTP status for an overall health status: 200 for `pass` and `warn` (the service
 * can take traffic), 503 for `fail`, as the draft recommends (2xx–3xx for pass and warn,
 * 4xx–5xx for fail).
 */
export function healthHttpStatus(status: HealthStatus): 200 | 503 {
  return status === "fail" ? 503 : 200;
}

/** A successful check that took `elapsedMs`: `warn` above `warnAboveMs`, else `pass`. */
export function latencyStatus(
  elapsedMs: number,
  warnAboveMs: number | undefined
): HealthStatus {
  return warnAboveMs !== undefined && elapsedMs > warnAboveMs ? "warn" : "pass";
}
