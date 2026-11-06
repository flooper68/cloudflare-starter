import type { Clock } from "../kernel";
import {
  type HealthCheckResult,
  type HealthComponentType,
  latencyStatus,
  type ProbeOutcome,
} from "./domain";

/** One dependency check of the readiness endpoint. */
export interface HealthProbe {
  /** `<componentName>:<measurementName>`, the key in the response's `checks`. */
  readonly name: string;
  readonly componentType: HealthComponentType;
  /**
   * Resolves when the dependency is healthy (or with an outcome of its own, for
   * configuration checks); throws or rejects when it is not.
   */
  // biome-ignore lint/suspicious/noConfusingVoidType: probes that only call a service return Promise<void>
  readonly run: () => Promise<ProbeOutcome | void> | ProbeOutcome | undefined;
  /** Report the latency as `observedValue` (in ms): for checks that call a service. */
  readonly measured?: boolean;
  /** A successful measured check slower than this is `warn`. */
  readonly warnAboveMs?: number;
}

const TIMED_OUT = Symbol("timed out");

function messageOf(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

/**
 * Runs one probe with a deadline: `fail` with output `timeout` when it does not settle
 * within `timeoutMs`, `fail` with output `error` (and the error message as `detail`) when
 * it throws, else its own outcome or `pass` (`warn` above its `warnAboveMs`). Never
 * throws. Spans and logs are the caller's (the HTTP edge).
 */
export async function runHealthCheck(
  deps: { readonly clock: Clock; readonly timeoutMs: number },
  probe: HealthProbe
): Promise<HealthCheckResult> {
  const started = deps.clock.now().getTime();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), deps.timeoutMs);
  });
  let outcome: ProbeOutcome;
  try {
    const settled = await Promise.race([
      Promise.resolve().then(probe.run),
      deadline,
    ]);
    outcome =
      settled === TIMED_OUT
        ? {
            status: "fail",
            output: "timeout",
            detail: `no answer within ${deps.timeoutMs} ms`,
          }
        : (settled ?? { status: "pass" });
  } catch (error) {
    outcome = { status: "fail", output: "error", detail: messageOf(error) };
  } finally {
    clearTimeout(timer);
  }
  const finished = deps.clock.now();
  const elapsed = Math.max(0, finished.getTime() - started);
  const slow =
    probe.measured &&
    outcome.status === "pass" &&
    latencyStatus(elapsed, probe.warnAboveMs) === "warn";
  return {
    name: probe.name,
    componentType: probe.componentType,
    status: slow ? "warn" : outcome.status,
    time: finished,
    ...(probe.measured
      ? { observedValue: elapsed, observedUnit: "ms" as const }
      : {}),
    ...(slow
      ? {
          output: "slow",
          detail: `took ${elapsed} ms (warns above ${probe.warnAboveMs} ms)`,
        }
      : {
          ...(outcome.output ? { output: outcome.output } : {}),
          ...(outcome.detail ? { detail: outcome.detail } : {}),
        }),
  };
}
