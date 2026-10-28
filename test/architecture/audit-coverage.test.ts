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
  "billing",
  "workspaces",
  "feature-flags",
] as const;

/** Use cases that change state without an audit event: path → reason. */
const AUDIT_EXEMPT: Readonly<Record<string, string>> = {
  "packages/features/src/billing/record-usage.ts":
    "usage metering (one counter increment per upload); grants or removes nothing, and the action it counts is the record",
  "packages/features/src/workspaces/switch-workspace.ts":
    "only moves the user's default workspace (last_active_at); grants or removes nothing",
};

/** A Drizzle write or raw SQL that inserts, updates or deletes. */
const STATE_CHANGE =
  /\.(insert|update|delete)\(|\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;

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
    expect(using(/\.update\(|\bUPDATE\s+\w+\s+SET\b/i)).toEqual([]);
  });
});
