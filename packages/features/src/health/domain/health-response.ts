/**
 * The health check response body in the IETF health check response format
 * (draft-inadarei-api-health-check, `application/health+json`). The public body shows
 * statuses, latencies and a short fixed reason per failed check; the admin view adds the
 * underlying error message (`detail`). Never secrets, hostnames or stack traces.
 */
import { aggregateHealthStatus, type HealthStatus } from "./health-status";

/** The draft's componentType values this app uses. */
export type HealthComponentType = "component" | "datastore" | "system";

/** The result of one check, as `runHealthCheck` produces it. */
export interface HealthCheckResult {
  /** The key in `checks`: `<componentName>:<measurementName>` (`d1:responseTime`). */
  readonly name: string;
  readonly componentType: HealthComponentType;
  readonly status: HealthStatus;
  /** When the check finished. */
  readonly time: Date;
  /** Latency in milliseconds, for checks that measure one (`…:responseTime`). */
  readonly observedValue?: number;
  readonly observedUnit?: "ms";
  /** Short, fixed reason for `warn` and `fail` (`timeout`, `error`, `missing binding`). */
  readonly output?: string;
  /** What went wrong, for logs and the admin view only; never in the public body. */
  readonly detail?: string;
}

/** One entry of the `checks` map. */
export interface HealthCheckEntry {
  readonly componentType: HealthComponentType;
  readonly status: HealthStatus;
  readonly time: string;
  readonly observedValue?: number;
  readonly observedUnit?: string;
  readonly output?: string;
}

/** A health check response body (`application/health+json`). */
export interface HealthResponseBody {
  readonly status: HealthStatus;
  /** Public version of the health API. */
  readonly version: string;
  /** The deployed release (the Worker version id). */
  readonly releaseId: string;
  readonly serviceId: string;
  readonly description: string;
  /** Summary for `warn` and `fail`, omitted on `pass`. */
  readonly output?: string;
  readonly checks: Readonly<Record<string, readonly HealthCheckEntry[]>>;
  /** The trace id of this request: quote it to find the check's logs. An extension member. */
  readonly reference: string;
}

export interface HealthResponseInput {
  readonly version: string;
  readonly releaseId: string;
  readonly serviceId: string;
  readonly description: string;
  readonly reference: string;
  readonly results: readonly HealthCheckResult[];
}

/** Longest `detail` shown to admins: error messages can be long. */
export const HEALTH_DETAIL_MAX_LENGTH = 300;

function outputOf(
  result: HealthCheckResult,
  detail: boolean
): string | undefined {
  if (result.status === "pass") return undefined;
  if (!detail || !result.detail) return result.output;
  const text = `${result.output ?? result.status}: ${result.detail}`;
  return text.length > HEALTH_DETAIL_MAX_LENGTH
    ? `${text.slice(0, HEALTH_DETAIL_MAX_LENGTH - 1)}…`
    : text;
}

function entryOf(result: HealthCheckResult, detail: boolean): HealthCheckEntry {
  const output = outputOf(result, detail);
  return {
    componentType: result.componentType,
    status: result.status,
    time: result.time.toISOString(),
    ...(result.observedValue === undefined
      ? {}
      : {
          observedValue: result.observedValue,
          observedUnit: result.observedUnit ?? "ms",
        }),
    ...(output ? { output } : {}),
  };
}

/**
 * The response body for these check results. `detail: true` (the admin view) appends each
 * failed or warned check's `detail` to its `output`; the public body never does.
 */
export function healthResponseBody(
  input: HealthResponseInput,
  options: { readonly detail: boolean } = { detail: false }
): HealthResponseBody {
  const status = aggregateHealthStatus(input.results.map((r) => r.status));
  const failed = input.results.filter((r) => r.status === "fail").length;
  const warned = input.results.filter((r) => r.status === "warn").length;
  const checks: Record<string, HealthCheckEntry[]> = {};
  for (const result of input.results) {
    const entries = checks[result.name] ?? [];
    entries.push(entryOf(result, options.detail));
    checks[result.name] = entries;
  }
  const total = input.results.length;
  return {
    status,
    version: input.version,
    releaseId: input.releaseId,
    serviceId: input.serviceId,
    description: input.description,
    ...(status === "pass"
      ? {}
      : {
          output:
            failed > 0
              ? `${failed} of ${total} checks failed`
              : `${warned} of ${total} checks warned`,
        }),
    checks,
    reference: input.reference,
  };
}
