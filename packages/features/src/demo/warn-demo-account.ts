import { eq } from "drizzle-orm";

import { user } from "../accounts";
import { findLatestAuditTimes, recordAuditEvent } from "../audit";
import type { Database } from "../database";
import {
  type Clock,
  DomainError,
  type Ids,
  type Notify,
  type RequestContext,
} from "../kernel";
import {
  type DemoRuntime,
  demoDeletionWarningNotification,
  demoRetentionDecision,
  isCurrentWarning,
} from "./domain";

export type WarnDemoAccountResult =
  | { readonly status: "sent"; readonly deletesAt: string }
  | {
      readonly status: "skipped";
      readonly reason:
        | "demo_off"
        | "gone"
        | "exempt"
        | "not_due"
        | "already_warned";
    };

/**
 * Handler of `demo.warn-account`: sends the "Your demo account will be deleted tomorrow"
 * notification (security-critical: always emailed, with the privacy export and GitHub
 * links) to one account the retention will erase, then records `demo.deletion_warned`,
 * which is what lets the retention erase it a day later. At most once per account: it
 * skips an account with a current warning, the job is keyed by user, and the event id is
 * stable, so a retry after the notification was queued dispatches nothing new. Re-judged as of
 * `asOf` with the current settings, so an account that became exempt is not warned.
 */
export async function warnDemoAccount(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly demo: DemoRuntime;
    readonly notify: Notify;
  },
  input: { readonly userId: string; readonly asOf: Date }
): Promise<WarnDemoAccountResult> {
  const { demo } = deps;
  if (demo.mode !== "on") return { status: "skipped", reason: "demo_off" };
  const [account] = await deps.db
    .select({ email: user.email, role: user.role, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!account) return { status: "skipped", reason: "gone" };
  const decision = demoRetentionDecision(account, demo.policy, input.asOf);
  if (decision.action === "exempt")
    return { status: "skipped", reason: "exempt" };
  if (decision.action === "keep")
    return { status: "skipped", reason: "not_due" };
  const warned = await findLatestAuditTimes(deps, {
    action: "demo.deletion_warned",
    targetType: "user",
    targetIds: [input.userId],
  });
  if (isCurrentWarning(warned.get(input.userId) ?? null, input.asOf))
    return { status: "skipped", reason: "already_warned" };

  // Erased by the first run at least a day after this one: "tomorrow" at the earliest.
  const deletesAt = new Date(
    Math.max(
      decision.deletesAt.getTime(),
      input.asOf.getTime() + 24 * 60 * 60 * 1000
    )
  ).toISOString();
  const sent = await deps.notify(demoDeletionWarningNotification, {
    recipients: [input.userId],
    data: { deletesAt },
    // A retry after the audit write failed sends nothing more: same event, same key.
    eventId: `demo-warning-${input.userId}-${input.asOf.toISOString()}`,
    context: {
      workspaceId: null,
      requestContext: { ...deps.requestContext, userId: null },
    },
  });
  if (sent.status === "failed")
    throw new DomainError(
      "unavailable",
      `The demo deletion warning could not be queued (reference ${sent.reference})`
    );
  await recordAuditEvent(deps, deps.requestContext, {
    action: "demo.deletion_warned",
    actor: { kind: "system" },
    workspaceId: null,
    target: { type: "user", id: input.userId },
    metadata: { deletesAt },
  });
  return { status: "sent", deletesAt };
}
