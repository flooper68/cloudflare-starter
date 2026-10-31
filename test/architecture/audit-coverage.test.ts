/**
 * The audit log stays complete and append-only (docs/guides/how-to-use-the-audit-log.md):
 * - every state-changing use case of an audited feature records an audit event, or is
 *   exempt with a reason;
 * - Better Auth's endpoints are recorded from server/auth-audit.ts;
 * - only the audit feature touches `audit_events`, and inside it only recordAuditEvent
 *   inserts and only purgeAuditEvents deletes; nothing updates.
 */
import { describe, expect, it } from "vitest";

import { filesUnder, read } from "./repo";

/** Features whose state changes are audited. Add a feature here when it is created. */
const AUDITED_FEATURES = [
  "accounts",
  "admin",
  "billing",
  "workspaces",
  "feature-flags",
  "notifications",
  "trash",
  "storage-reconciliation",
  "privacy",
] as const;

/** Use cases that change state without an audit event: path → reason. */
const AUDIT_EXEMPT: Readonly<Record<string, string>> = {
  "packages/features/src/privacy/erase-user-exports.ts":
    "Cleanup inside account/workspace erasure; privacy.user_erased or workspace.deleted is recorded by its owner.",
  "packages/features/src/privacy/erase-identity-references.ts":
    "Cleanup inside erasure; completion records privacy.user_erased.",
  "packages/features/src/privacy/prepare-user-erasure.ts":
    "Pre-auth cleanup; completion after the auth gateway records privacy.user_erased, never claim erasure before auth deletion.",
  "packages/features/src/privacy/purge-data-exports.ts":
    "Automatic expiry of temporary export downloads; no new access or user action.",
  "packages/features/src/accounts/purge-account-images.ts":
    "storage cleanup within authorized account deletion; self-delete afterDelete and the admin delete use case record user.deleted",
  "packages/features/src/workspaces/purge-workspace-logos.ts":
    "storage cleanup within authorized workspace/account deletion; the parent records workspace.deleted",
  "packages/features/src/billing/record-usage.ts":
    "usage metering (one counter increment per upload); grants or removes nothing, and the action it counts is the record",
  "packages/features/src/workspaces/switch-workspace.ts":
    "only moves the user's default workspace (last_active_at); grants or removes nothing",
  "packages/features/src/notifications/dispatch-notification.ts":
    "delivery: writes the recipient's own inbox rows for an event the producing use case records",
  "packages/features/src/notifications/send-notification-email.ts":
    "delivery: marks the recipient's own inbox row's email sent or skipped",
  "packages/features/src/notifications/send-digest.ts":
    "delivery: marks the recipient's own inbox rows' email sent in the daily digest",
  "packages/features/src/notifications/purge-notifications.ts":
    "retention: deletes inbox rows past their fixed retention (retention.ts), like the audit purge",
  "packages/features/src/notifications/mark-notifications-read.ts":
    "recipient's own inbox state: read markers grant or remove nothing",
  "packages/features/src/notifications/archive-notifications.ts":
    "recipient's own inbox state: archiving grants or removes nothing",
};

/**
 * A Drizzle write or raw SQL that inserts, updates or deletes, or a change made through the
 * admin portal's auth gateway (packages/features/src/admin/ports) or by deleting a user's
 * workspaces.
 */
const STATE_CHANGE =
  /\.(insert|update|delete)\(|\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b|\bgateway\.(setRole|ban|unban|revokeSessions|deleteUser|sendPasswordReset|startImpersonation|stopImpersonation)\(|\bprepareUserDeletion\(/i;

const notTest = /(?<!\.test)\.tsx?$/;

/** Use-case files of a feature: top level, not the barrel, schema or tests. */
function useCasesOf(feature: string): string[] {
  return filesUnder(
    `packages/features/src/${feature}`,
    new RegExp(
      `^packages/features/src/${feature}/(?!index\\.ts$)[^/]+(?<!\\.schema|\\.test|\\.integration\\.test)\\.ts$`
    )
  );
}

const auditedUseCases = AUDITED_FEATURES.flatMap(useCasesOf);
const stateChanging = auditedUseCases.filter((path) =>
  STATE_CHANGE.test(read(path))
);

describe("audit coverage", () => {
  it("finds the audited features", () => {
    for (const feature of AUDITED_FEATURES) {
      expect(useCasesOf(feature).length, feature).toBeGreaterThan(0);
    }
  });

  it.each(
    stateChanging.length ? stateChanging : ["(no state-changing use case yet)"]
  )("%s records an audit event or is exempt", (path) => {
    if (!stateChanging.includes(path)) return;
    const records =
      /import\s*\{[^}]*\brecordAuditEvent\b[^}]*\}\s*from\s*["']\.\.\/audit["']/.test(
        read(path)
      ) && /\brecordAuditEvent\(/.test(read(path));
    expect(
      records || path in AUDIT_EXEMPT,
      "call recordAuditEvent (from ../audit) after the change, or add it to AUDIT_EXEMPT with a reason"
    ).toBe(true);
  });

  it("every exemption names an existing use case and a reason", () => {
    for (const [path, reason] of Object.entries(AUDIT_EXEMPT)) {
      expect(auditedUseCases, path).toContain(path);
      expect(reason.trim().length, path).toBeGreaterThan(10);
    }
  });

  it("records Better Auth's sign-in, failed sign-in, sign-up, reset requests and password changes", () => {
    const hooks = read("apps/web/src/server/auth-audit.ts");
    for (const action of [
      "auth.sign_in",
      "auth.sign_in_failed",
      "auth.sign_up",
      "auth.password_reset_requested",
      "auth.password_changed",
    ]) {
      expect(hooks, action).toContain(`action: "${action}"`);
    }
    expect(read("apps/web/src/server/auth.ts")).toContain(
      "auditPasswordReset(env, user.id, request)"
    );
    // The audit hooks are composed with the workspace hooks on the same events.
    const auth = read("apps/web/src/server/auth.ts");
    expect(auth).toContain("const audit = auditDatabaseHooks(env);");
    expect(auth).toContain("session: audit.session,");
    expect(auth).toContain("await audit.user?.create?.after?.(user, ctx);");
    expect(auth).toMatch(
      /after: createAuthMiddleware\(\(ctx\) => auditAuthEndpoint\(env, ctx\)\)/
    );
  });
});

describe("audit_events is append-only", () => {
  const sources = [
    ...filesUnder("packages/features/src", notTest),
    ...filesUnder("apps/web/src", notTest),
  ];
  const auditFeature = /^packages\/features\/src\/audit\//;

  it("only the audit feature (and the schema composition root) mentions the table", () => {
    const outside = sources.filter(
      (path) =>
        !auditFeature.test(path) &&
        path !== "packages/features/src/database.ts" &&
        path !== "packages/features/src/data-catalog.ts" &&
        /\bauditEvents\b|\baudit_events\b/.test(read(path))
    );
    expect(outside, "write audit events through recordAuditEvent").toEqual([]);
  });

  it("only recordAuditEvent inserts and only purgeAuditEvents deletes; nothing updates", () => {
    const writers = sources.filter((path) => auditFeature.test(path));
    const using = (pattern: RegExp) =>
      writers.filter((path) => pattern.test(read(path)));
    expect(using(/\.insert\(|\bINSERT\s+INTO\b/i)).toEqual([
      "packages/features/src/audit/record-audit-event.ts",
    ]);
    expect(using(/\.delete\(|\bDELETE\s+FROM\b/i)).toEqual([
      "packages/features/src/audit/purge-audit-events.ts",
    ]);
    expect(using(/\.update\(|\bUPDATE\s+\w+\s+SET\b/i)).toEqual([
      "packages/features/src/audit/redact-audit-subject.ts",
    ]);
    const redactor = read(
      "packages/features/src/audit/redact-audit-subject.ts"
    );
    expect(redactor).not.toMatch(
      /\.set\(\{[^}]*\b(action|occurredAt|actorUserId|actorKind|outcome|traceId)\s*:/s
    );
  });
});
