import { and, asc, eq, gt, lte, or } from "drizzle-orm";

import { user } from "../accounts";
import { type AdminAuthGateway, LastAdminError } from "../admin";
import { findLatestAuditTimes } from "../audit";
import type { Database } from "../database";
import { enqueueJob } from "../jobs";
import {
  type Clock,
  DomainError,
  type Ids,
  type RequestContext,
} from "../kernel";
import type { ErrorReporter, JobQueue, Logger } from "../platform";
import { LastOwnerError } from "../workspaces";
import {
  DEMO_ERASE_BATCH,
  DEMO_MAX_BATCHES_PER_RUN,
  DEMO_SCAN_MAX,
  DEMO_WARN_CAP,
  type DemoRuntime,
  demoRetentionDecision,
  demoWarnCutoff,
  enforceDemoRetentionJob,
  isCurrentWarning,
  warnDemoAccountJob,
  warnedLongEnoughAgo,
} from "./domain";
import { eraseDemoAccount } from "./erase-demo-account";
import { retentionSubjects } from "./retention-subjects";

const PAGE = 100;

export type EnforceDemoRetentionResult =
  | { readonly status: "off" }
  | {
      readonly status: "done";
      /** Warning jobs enqueued (first batch only). */
      readonly warned: number;
      readonly erased: number;
      /** Refused by the erasure preflight (last owner or last admin); tried again tomorrow. */
      readonly blocked: number;
      /** Failed for another reason (reported); tried again tomorrow. */
      readonly failed: number;
      /** Whether it enqueued the next batch. */
      readonly continued: boolean;
    };

/**
 * Handler of `demo.enforce-retention`, one batch of the daily demo retention as of `asOf`:
 * 1. Looks at the accounts the retention applies to (`retentionSubjects`, then
 *    `demoRetentionDecision` for each) that are at least DEMO_RETENTION_DAYS − 1 days old,
 *    oldest first, at most DEMO_SCAN_MAX.
 * 2. First batch only: enqueues `demo.warn-account` (keyed by user) for each one without
 *    a current warning (a `demo.deletion_warned` event within DEMO_WARNING_VALID_MS), at
 *    most DEMO_WARN_CAP and no more than the next run can erase.
 * 3. Erases, through `eraseDemoAccount`, the ones past DEMO_RETENTION_DAYS whose current
 *    warning is at least DEMO_WARNING_LEAD_MS old: after skipping `skip` accounts
 *    earlier batches could not erase, up to DEMO_ERASE_BATCH attempts. An account the
 *    preflight refuses (last owner of a workspace others use) is counted as blocked and
 *    tried again on the next day's run; another failure is reported and counted.
 * 4. Enqueues the next batch (same `asOf`) while more remain, up to
 *    DEMO_MAX_BATCHES_PER_RUN batches per run.
 * Idempotent: erased accounts are gone, warnings are deduplicated by the warning job,
 * and each batch is keyed by `asOf` and its number. Settings are read when it runs.
 */
export async function enforceDemoRetention(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
    readonly logger: Logger;
    readonly errors: ErrorReporter;
    readonly jobQueue: JobQueue;
    readonly demo: DemoRuntime;
    readonly authUsers: Pick<AdminAuthGateway, "deleteUser">;
    readonly eraseUserArtifacts: (input: {
      userId: string;
      email: string;
    }) => Promise<void>;
    readonly eraseWorkspaceArtifacts: (
      ids: readonly string[],
      userId: string
    ) => Promise<void>;
  },
  input: {
    readonly asOf: Date;
    readonly batch: number;
    /** Accounts earlier batches of this run could not erase, skipped by this one. */
    readonly skip?: number;
  }
): Promise<EnforceDemoRetentionResult> {
  const { demo } = deps;
  if (demo.mode !== "on") return { status: "off" };
  const { policy } = demo;
  const now = input.asOf;
  const cutoff = demoWarnCutoff(now, policy.retentionDays);
  const subjects = retentionSubjects(policy);

  // Oldest first, keyset paged on (created_at, id).
  const due: { id: string; erase: boolean }[] = [];
  let cursor: { createdAt: Date; id: string } | null = null;
  while (due.length < DEMO_SCAN_MAX) {
    const page: {
      id: string;
      email: string;
      role: string | null;
      createdAt: Date;
    }[] = await deps.db
      .select({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(
        and(
          lte(user.createdAt, cutoff),
          subjects,
          cursor
            ? or(
                gt(user.createdAt, cursor.createdAt),
                and(
                  eq(user.createdAt, cursor.createdAt),
                  gt(user.id, cursor.id)
                )
              )
            : undefined
        )
      )
      .orderBy(asc(user.createdAt), asc(user.id))
      .limit(PAGE);
    for (const account of page) {
      const decision = demoRetentionDecision(account, policy, now);
      if (decision.action === "warn" || decision.action === "erase")
        due.push({ id: account.id, erase: decision.action === "erase" });
    }
    const last = page.at(-1);
    if (!last || page.length < PAGE) break;
    cursor = { createdAt: last.createdAt, id: last.id };
  }

  const warnedAt = await findLatestAuditTimes(deps, {
    action: "demo.deletion_warned",
    targetType: "user",
    targetIds: due.map((account) => account.id),
  });

  let warned = 0;
  const erasableAll = due.filter(
    (account) =>
      account.erase &&
      warnedLongEnoughAgo(warnedAt.get(account.id) ?? null, now)
  );
  if (input.batch === 0) {
    // No more warnings than the next run can erase, so "tomorrow" stays true when a
    // backlog (demo mode just turned on) is larger than a day's cap.
    const warnCap = Math.min(
      DEMO_WARN_CAP,
      Math.max(
        0,
        DEMO_ERASE_BATCH * DEMO_MAX_BATCHES_PER_RUN - erasableAll.length
      )
    );
    for (const account of due) {
      if (warned >= warnCap) break;
      if (isCurrentWarning(warnedAt.get(account.id) ?? null, now)) continue;
      await enqueueJob(
        deps,
        warnDemoAccountJob,
        { userId: account.id, asOf: now.toISOString() },
        { context: deps.requestContext }
      );
      warned += 1;
    }
  }

  const erasable = erasableAll.slice(input.skip ?? 0);
  const attempt = erasable.slice(0, DEMO_ERASE_BATCH);
  let erased = 0;
  let blocked = 0;
  let failed = 0;
  for (const account of attempt) {
    try {
      await eraseDemoAccount(deps, {
        userId: account.id,
        retentionDays: policy.retentionDays,
      });
      erased += 1;
    } catch (error) {
      if (error instanceof LastOwnerError || error instanceof LastAdminError) {
        blocked += 1;
        deps.logger.warn("demo.erasure_blocked", {
          "user.id": account.id,
          "app.demo.reason":
            error instanceof LastOwnerError ? "last_owner" : "last_admin",
        });
        continue;
      }
      // Another erasure holds the global lock: retry the whole batch later.
      if (error instanceof DomainError && error.code === "ERASURE_BUSY")
        throw error;
      failed += 1;
      deps.errors.capture(error, deps.requestContext, {
        "user.id": account.id,
        "app.demo.operation": "erase",
      });
    }
  }

  const continued =
    erasable.length > attempt.length &&
    input.batch + 1 < DEMO_MAX_BATCHES_PER_RUN;
  if (continued) {
    await enqueueJob(
      deps,
      enforceDemoRetentionJob,
      {
        asOf: now.toISOString(),
        batch: input.batch + 1,
        skip: (input.skip ?? 0) + blocked + failed,
      },
      { context: deps.requestContext }
    );
  }
  deps.logger.info("demo.retention_batch", {
    "app.demo.batch": input.batch,
    "app.demo.warned": warned,
    "app.demo.erased": erased,
    "app.demo.blocked": blocked,
    "app.demo.failed": failed,
  });
  return { status: "done", warned, erased, blocked, failed, continued };
}
