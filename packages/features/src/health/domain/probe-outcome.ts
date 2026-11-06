/**
 * What a probe reports when it does not simply succeed or throw: configuration checks
 * that look at bindings and settings rather than calling a service.
 */
import type { HealthStatus } from "./health-status";

export interface ProbeOutcome {
  readonly status: HealthStatus;
  /** Short, fixed reason, safe for the public body. */
  readonly output?: string;
  /** Specifics for logs and the admin view (which binding, which setting). */
  readonly detail?: string;
}

/** `pass` when every named binding is present, else `fail` naming the missing ones. */
export function bindingsOutcome(
  bindings: Readonly<Record<string, unknown>>
): ProbeOutcome {
  const missing = Object.entries(bindings)
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name)
    .sort();
  if (missing.length === 0) return { status: "pass" };
  return {
    status: "fail",
    output: "missing binding",
    detail: `not bound: ${missing.join(", ")}`,
  };
}

/**
 * Outgoing mail: `pass` when configured (the EMAIL binding and EMAIL_FROM). Without it
 * the app still serves, minus mail (`warn`), unless sign-up requires email verification,
 * which cannot complete without mail (`fail`).
 */
export function emailOutcome(input: {
  readonly configured: boolean;
  readonly verificationRequired: boolean;
}): ProbeOutcome {
  if (input.configured) return { status: "pass" };
  const detail = "the EMAIL send_email binding or EMAIL_FROM is missing";
  return input.verificationRequired
    ? {
        status: "fail",
        output: "not configured",
        detail: `${detail}, and AUTH_REQUIRE_EMAIL_VERIFICATION needs mail`,
      }
    : { status: "warn", output: "not configured", detail };
}
