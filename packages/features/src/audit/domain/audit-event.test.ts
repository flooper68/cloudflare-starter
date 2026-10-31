import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditEventInput,
  auditEventSchema,
} from "./audit-event";
import { SECRET_KEY_PATTERN } from "./redact";

const user = { type: "user", id: "user-ada" } as const;
const email = { type: "email", id: "ada@example.test" } as const;
const workspace = "ws-analytical-engines";

/** One valid event per action, the smallest the catalog accepts. */
const VALID: Record<AuditAction, AuditEventInput> = {
  "account.settings_updated": {
    action: "account.settings_updated",
    target: user,
  },
  "account.session_revoked": {
    action: "account.session_revoked",
    target: user,
  },
  "account.avatar_updated": { action: "account.avatar_updated", target: user },
  "account.avatar_removed": { action: "account.avatar_removed", target: user },
  "workspace.updated": {
    action: "workspace.updated",
    target: { type: "workspace", id: workspace },
    workspaceId: workspace,
  },
  "workspace.logo_updated": {
    action: "workspace.logo_updated",
    target: { type: "workspace", id: workspace },
    workspaceId: workspace,
  },
  "workspace.logo_removed": {
    action: "workspace.logo_removed",
    target: { type: "workspace", id: workspace },
    workspaceId: workspace,
  },

  "storage.reconciliation_requested": {
    action: "storage.reconciliation_requested",
    target: { type: "storage", id: "run" },
    metadata: { mode: "report" },
  },
  "storage.reconciliation_page": {
    action: "storage.reconciliation_page",
    target: { type: "storage", id: "run" },
    metadata: {
      mode: "report",
      prefix: "users/",
      scanned: 1,
      orphaned: 1,
      deleted: 0,
      continued: false,
      sampleKeys: ["users/one/avatar/two"],
    },
  },
  "auth.sign_in": {
    action: "auth.sign_in",
    target: user,
    metadata: { method: "password" },
  },
  "auth.sign_in_failed": {
    action: "auth.sign_in_failed",
    target: email,
    metadata: { method: "password", reason: "INVALID_EMAIL_OR_PASSWORD" },
  },
  "auth.human_check_failed": {
    action: "auth.human_check_failed",
    target: email,
    metadata: { form: "sign-up", reason: "rejected" },
  },
  "auth.sign_up": {
    action: "auth.sign_up",
    target: user,
    metadata: { method: "social", provider: "google" },
  },
  "auth.password_reset_requested": {
    action: "auth.password_reset_requested",
    target: email,
  },
  "auth.password_changed": {
    action: "auth.password_changed",
    target: user,
    metadata: { method: "reset" },
  },
  "user.role_changed": {
    action: "user.role_changed",
    actor: { kind: "admin", userId: "user-grace" },
    target: user,
    metadata: { previousRole: "user", role: "admin" },
  },
  "user.banned": {
    action: "user.banned",
    actor: { kind: "admin", userId: "user-grace" },
    target: user,
    metadata: { reason: "Spam", expiresAt: "2026-12-01T00:00:00.000Z" },
  },
  "user.unbanned": { action: "user.unbanned", target: user },
  "user.sessions_revoked": {
    action: "user.sessions_revoked",
    target: user,
    metadata: { sessionCount: 3 },
  },
  "user.deleted": { action: "user.deleted", target: user },
  "user.password_reset_sent": {
    action: "user.password_reset_sent",
    actor: { kind: "admin", userId: "user-grace" },
    target: user,
  },
  "impersonation.started": {
    action: "impersonation.started",
    actor: { kind: "admin", userId: "user-grace" },
    target: user,
  },
  "impersonation.stopped": {
    action: "impersonation.stopped",
    actor: { kind: "admin", userId: "user-grace" },
    target: user,
  },
  "notifications.preferences_changed": {
    action: "notifications.preferences_changed",
    target: user,
    metadata: { changes: 2, emailCadence: "daily" },
  },
  "notifications.unsubscribed": {
    action: "notifications.unsubscribed",
    target: user,
    metadata: { type: "workspaces.member-joined", channel: "email" },
  },
  "impersonation.oauth_refused": {
    action: "impersonation.oauth_refused",
    actor: { kind: "admin", userId: "user-grace" },
    target: user,
    metadata: { clientId: "claude-desktop" },
  },
  "workspace.invitation_created": {
    action: "workspace.invitation_created",
    workspaceId: workspace,
    target: { type: "invitation", id: "inv-1" },
    metadata: { email: "alan@example.test", role: "member" },
  },
  "workspace.invitation_accepted": {
    action: "workspace.invitation_accepted",
    workspaceId: workspace,
    target: { type: "invitation", id: "inv-1" },
    metadata: { role: "member" },
  },
  "workspace.invitation_revoked": {
    action: "workspace.invitation_revoked",
    workspaceId: workspace,
    target: { type: "invitation", id: "inv-1" },
  },
  "workspace.member_role_changed": {
    action: "workspace.member_role_changed",
    workspaceId: workspace,
    target: user,
    metadata: { previousRole: "member", role: "admin" },
  },
  "workspace.member_removed": {
    action: "workspace.member_removed",
    workspaceId: workspace,
    target: user,
  },
  "workspace.ownership_transferred": {
    action: "workspace.ownership_transferred",
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
    metadata: { previousOwnerUserId: "user-ada", ownerUserId: "user-grace" },
  },
  "feature_flag.updated": {
    action: "feature_flag.updated",
    actor: { kind: "admin", userId: "user-grace" },
    workspaceId: null,
    target: { type: "feature_flag", id: "upload-demo-presigned" },
    metadata: { enabled: true, fallthrough: false },
  },
  "feature_flag.rules_changed": {
    action: "feature_flag.rules_changed",
    actor: { kind: "admin", userId: "user-grace" },
    workspaceId: null,
    target: { type: "feature_flag", id: "upload-demo-presigned" },
    metadata: { ruleCount: 2, ruleKinds: ["workspace", "percentage"] },
  },
  "workspace.owner_assigned": {
    action: "workspace.owner_assigned",
    actor: { kind: "admin", userId: "user-grace" },
    workspaceId: workspace,
    target: user,
    metadata: { previousRole: null },
  },
  "workspace.deleted": {
    action: "workspace.deleted",
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
  },
  "billing.trial_started": {
    action: "billing.trial_started",
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
    metadata: { planId: "pro", trialEndsAt: "2026-11-11T12:00:00.000Z" },
  },
  "billing.plan_assigned": {
    action: "billing.plan_assigned",
    actor: { kind: "admin", userId: "user-grace" },
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
    metadata: { previousPlanId: "free", planId: "pro", status: "active" },
  },
  "billing.addons_set": {
    action: "billing.addons_set",
    actor: { kind: "admin", userId: "user-grace" },
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
    metadata: { addons: [{ addonId: "extra_seats", quantity: 2 }] },
  },
  "billing.override_set": {
    action: "billing.override_set",
    actor: { kind: "admin", userId: "user-grace" },
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
    metadata: {
      key: "seats",
      kind: "limit",
      limit: 40,
      reason: "Pilot customer",
    },
  },
  "billing.plan_lapsed": {
    action: "billing.plan_lapsed",
    actor: { kind: "system" },
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
    metadata: { previousPlanId: "pro", planId: "free", reason: "trial_ended" },
  },
  "billing.subscription_changed": {
    action: "billing.subscription_changed",
    actor: { kind: "system" },
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
    metadata: {
      previousPlanId: null,
      planId: "pro",
      status: "active",
      provider: "stripe",
    },
  },
  "trash.item_trashed": {
    action: "trash.item_trashed",
    workspaceId: workspace,
    target: { type: "file", id: "file-roadmap" },
    metadata: { entityType: "file" },
  },
  "trash.item_restored": {
    action: "trash.item_restored",
    workspaceId: workspace,
    target: { type: "file", id: "file-roadmap" },
    metadata: { entityType: "file" },
  },
  "trash.item_purged": {
    action: "trash.item_purged",
    actor: { kind: "system" },
    workspaceId: workspace,
    target: { type: "file", id: "file-roadmap" },
    metadata: { entityType: "file", reason: "retention" },
  },
  "workspace.created": {
    action: "workspace.created",
    workspaceId: workspace,
    target: { type: "workspace", id: workspace },
    metadata: { kind: "shared" },
  },
  "workspace.member_joined": {
    action: "workspace.member_joined",
    workspaceId: workspace,
    target: user,
    metadata: { role: "member" },
  },
  "workspace.member_left": {
    action: "workspace.member_left",
    workspaceId: workspace,
    target: user,
    metadata: { role: "member" },
  },
};

describe("auditEventSchema", () => {
  it("lists every action of the catalog", () => {
    expect([...AUDIT_ACTIONS].sort()).toEqual(Object.keys(VALID).sort());
  });

  it.each(AUDIT_ACTIONS)("accepts a valid %s", (action) => {
    const parsed = auditEventSchema.parse(VALID[action]);
    expect(parsed.action).toBe(action);
    expect(parsed.metadata).toBeTypeOf("object");
  });

  it.each(AUDIT_ACTIONS)(
    "rejects %s with an undeclared metadata key",
    (action) => {
      const event = VALID[action];
      const result = auditEventSchema.safeParse({
        ...event,
        metadata: { ...event.metadata, note: "anything else" },
      });
      expect(result.success).toBe(false);
    }
  );

  it.each(AUDIT_ACTIONS)("rejects %s with the wrong target type", (action) => {
    const event = VALID[action];
    const wrong = event.target.type === "user" ? email : user;
    expect(
      auditEventSchema.safeParse({ ...event, target: wrong }).success
    ).toBe(false);
  });

  it("rejects an action outside the catalog", () => {
    expect(
      auditEventSchema.safeParse({
        action: "user.renamed",
        target: user,
        metadata: {},
      }).success
    ).toBe(false);
  });

  it("defaults the outcome to success, and to failure for a failed sign-in", () => {
    expect(auditEventSchema.parse(VALID["auth.sign_in"]).outcome).toBe(
      "success"
    );
    expect(auditEventSchema.parse(VALID["auth.sign_in_failed"]).outcome).toBe(
      "failure"
    );
    expect(
      auditEventSchema.safeParse({
        ...VALID["auth.sign_in_failed"],
        outcome: "success",
      }).success
    ).toBe(false);
  });

  it("requires a workspace for workspace actions only", () => {
    const { workspaceId: _, ...withoutWorkspace } =
      VALID["workspace.member_removed"];
    expect(auditEventSchema.safeParse(withoutWorkspace).success).toBe(false);
    expect(auditEventSchema.safeParse(VALID["user.deleted"]).success).toBe(
      true
    );
  });

  it("trash events name a trashable target and a known purge reason", () => {
    expect(
      auditEventSchema.safeParse({
        ...VALID["trash.item_trashed"],
        target: { type: "workspace", id: workspace },
      }).success
    ).toBe(false);
    expect(
      auditEventSchema.safeParse({
        ...VALID["trash.item_purged"],
        metadata: { entityType: "file", reason: "because" },
      }).success
    ).toBe(false);
    expect(
      auditEventSchema.safeParse({
        ...VALID["trash.item_restored"],
        workspaceId: undefined,
      }).success
    ).toBe(false);
  });

  it("rejects a password in sign-in metadata", () => {
    expect(
      auditEventSchema.safeParse({
        ...VALID["auth.sign_in_failed"],
        metadata: {
          method: "password",
          reason: "INVALID_EMAIL_OR_PASSWORD",
          password: "hunter2-hunter2",
        },
      }).success
    ).toBe(false);
  });

  it("declares no credential-like metadata key in any action", () => {
    for (const option of auditEventSchema.options) {
      const metadata = option.shape.metadata;
      const shape =
        "shape" in metadata ? metadata.shape : metadata.unwrap().shape;
      for (const key of Object.keys(shape)) {
        expect(SECRET_KEY_PATTERN.test(key), key).toBe(false);
      }
    }
  });
});
