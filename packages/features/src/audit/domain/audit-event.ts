import { z } from "zod";

/**
 * The audit event catalog: every action the app records, with the target it acts on and a
 * `.strict()` metadata schema, so a field that is not declared here (a token, a password, a
 * whole request body) cannot reach the audit log. Field names follow OCSF (actor, action,
 * target, outcome, time, origin); the mapping is in docs/guides/how-to-use-the-audit-log.md.
 */

/** Whether the action succeeded (OCSF `status_id` 1) or was refused or failed (2). */
export const AUDIT_OUTCOMES = ["success", "failure"] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/** Who acted: a signed-in user, an operator acting as admin, or the system itself (cron, queue). */
export const AUDIT_ACTOR_KINDS = ["user", "admin", "system"] as const;
export type AuditActorKind = (typeof AUDIT_ACTOR_KINDS)[number];

/** What an action is about; `id` is that thing's id (an email for attempts on an address). */
export const AUDIT_TARGET_TYPES = [
  "user",
  "email",
  "workspace",
  "invitation",
  "feature_flag",
  "file",
  "storage",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/**
 * Targets that can sit in a workspace's trash: one per entity of the trash catalog
 * (packages/features/src/trash-catalog.ts), whose `type` must be one of these.
 */
export const AUDIT_TRASH_TARGET_TYPES = [
  "file",
] as const satisfies readonly AuditTargetType[];
export type AuditTrashTargetType = (typeof AUDIT_TRASH_TARGET_TYPES)[number];

const ID_MAX = 320;
const TEXT_MAX = 200;

const id = z.string().min(1).max(ID_MAX);
const text = z.string().min(1).max(TEXT_MAX);
const role = z.string().min(1).max(64);
const catalogId = z.string().min(1).max(100);
const subscriptionStatus = z.enum([
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

export const auditActorSchema = z
  .object({
    kind: z.enum(AUDIT_ACTOR_KINDS),
    userId: id.nullish(),
    /** The admin acting as `userId` during impersonation. */
    impersonatorUserId: id.nullish(),
  })
  .strict();
export type AuditActor = z.infer<typeof auditActorSchema>;

function target<const T extends AuditTargetType>(type: T) {
  return z.object({ type: z.literal(type), id }).strict();
}

const trashEntityType = z.enum(AUDIT_TRASH_TARGET_TYPES);
/** A trashed thing: its type is also `metadata.entityType`. */
const trashTarget = z.object({ type: trashEntityType, id }).strict();

/** Fields every event has besides its action, target and metadata. */
const common = {
  outcome: z.enum(AUDIT_OUTCOMES).default("success"),
  /** Defaults to the context's user, or the system when there is none. */
  actor: auditActorSchema.optional(),
  /** Defaults to the context's workspace. */
  workspaceId: id.nullish(),
};

/** Workspace actions always name their workspace. */
const inWorkspace = { ...common, workspaceId: id };

const noMetadata = z.object({}).strict().default({});

const signInMethod = z.enum([
  "password",
  "social",
  "sign_up",
  "email_verification",
  "other",
]);
const flagValue = z.union([z.boolean(), z.string().max(TEXT_MAX), z.number()]);
const signUpMethod = z.enum(["password", "social", "other"]);

export const auditEventSchema = z.discriminatedUnion("action", [
  z.object({
    ...common,
    action: z.literal("account.settings_updated"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    action: z.literal("account.session_revoked"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    action: z.literal("account.avatar_updated"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    action: z.literal("account.avatar_removed"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.updated"),
    target: target("workspace"),
    metadata: noMetadata,
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.logo_updated"),
    target: target("workspace"),
    metadata: noMetadata,
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.logo_removed"),
    target: target("workspace"),
    metadata: noMetadata,
  }),

  z.object({
    ...common,
    action: z.literal("storage.reconciliation_requested"),
    target: z.object({ type: z.literal("storage"), id }),
    metadata: z.object({ mode: z.enum(["report", "delete"]) }).strict(),
  }),
  z.object({
    ...common,
    action: z.literal("storage.reconciliation_page"),
    target: z.object({ type: z.literal("storage"), id }),
    metadata: z
      .object({
        mode: z.enum(["report", "delete"]),
        prefix: z.enum(["users/", "workspaces/"]),
        scanned: z.number().int().nonnegative(),
        orphaned: z.number().int().nonnegative(),
        deleted: z.number().int().nonnegative(),
        continued: z.boolean(),
        sampleKeys: z.array(z.string().max(1024)).max(5),
      })
      .strict(),
  }),
  // Authentication (recorded from Better Auth hooks in apps/web/src/server/auth-audit.ts).
  z.object({
    ...common,
    action: z.literal("auth.sign_in"),
    target: target("user"),
    metadata: z
      .object({ method: signInMethod, provider: text.optional() })
      .strict(),
  }),
  z.object({
    ...common,
    outcome: z.literal("failure").default("failure"),
    action: z.literal("auth.sign_in_failed"),
    target: target("email"),
    metadata: z
      .object({
        method: z.literal("password"),
        /** Better Auth's error code, such as INVALID_EMAIL_OR_PASSWORD. */
        reason: text,
      })
      .strict(),
  }),
  z.object({
    ...common,
    outcome: z.literal("failure").default("failure"),
    action: z.literal("auth.human_check_failed"),
    target: target("email"),
    metadata: z
      .object({
        /** The form the check guarded. */
        form: z.enum(["sign-up", "sign-in", "password-reset"]),
        /** missing: no token; rejected: Siteverify said no; unavailable: no answer. */
        reason: z.enum(["missing", "rejected", "unavailable"]),
      })
      .strict(),
  }),
  z.object({
    ...common,
    action: z.literal("auth.sign_up"),
    target: target("user"),
    metadata: z
      .object({ method: signUpMethod, provider: text.optional() })
      .strict(),
  }),
  z.object({
    ...common,
    action: z.literal("auth.password_reset_requested"),
    target: target("email"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    action: z.literal("auth.password_changed"),
    target: target("user"),
    metadata: z
      .object({
        /** `change`: signed in, current password given; `reset`: through an emailed link. */
        method: z.enum(["change", "reset"]),
        /** Better Auth's error code when the change was refused. */
        reason: text.optional(),
      })
      .strict(),
  }),

  z.object({
    ...common,
    action: z.literal("auth.second_factor_verified"),
    target: target("user"),
    metadata: z
      .object({ method: z.enum(["totp", "email", "backup"]) })
      .strict(),
  }),
  z.object({
    ...common,
    action: z.literal("auth.factor_changed"),
    target: target("user"),
    metadata: z
      .object({
        change: z.enum([
          "enabled",
          "disabled",
          "backup_regenerated",
          "passkey_added",
          "passkey_removed",
        ]),
      })
      .strict(),
  }),
  z.object({
    ...common,
    action: z.literal("user.second_factor_reset"),
    target: target("user"),
    metadata: noMetadata,
  }),

  // User administration (recorded by the admin portal).
  z.object({
    ...common,
    action: z.literal("user.role_changed"),
    target: target("user"),
    metadata: z.object({ previousRole: role, role }).strict(),
  }),
  z.object({
    ...common,
    action: z.literal("user.banned"),
    target: target("user"),
    metadata: z
      .object({
        reason: text.optional(),
        expiresAt: z.iso.datetime().optional(),
      })
      .strict(),
  }),
  z.object({
    ...common,
    action: z.literal("user.unbanned"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    action: z.literal("user.sessions_revoked"),
    target: target("user"),
    metadata: z
      .object({ sessionCount: z.number().int().nonnegative().optional() })
      .strict(),
  }),
  z.object({
    ...common,
    /** An admin sent the user a password reset link. */
    action: z.literal("user.password_reset_sent"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    action: z.literal("user.deleted"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    action: z.literal("impersonation.started"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    action: z.literal("impersonation.stopped"),
    target: target("user"),
    metadata: noMetadata,
  }),
  z.object({
    ...common,
    outcome: z.literal("failure").default("failure"),
    /** An impersonation session tried to authorize an OAuth (MCP) client as the user. */
    action: z.literal("impersonation.oauth_refused"),
    target: target("user"),
    metadata: z.object({ clientId: text.optional() }).strict().default({}),
  }),

  // Workspaces (recorded by the workspace use cases).
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.created"),
    target: target("workspace"),
    metadata: z.object({ kind: z.enum(["personal", "shared"]) }).strict(),
  }),
  z.object({
    ...inWorkspace,
    /** Joined without an invitation: single mode at sign-up. */
    action: z.literal("workspace.member_joined"),
    target: target("user"),
    metadata: z.object({ role }).strict(),
  }),
  z.object({
    ...inWorkspace,
    /** Left on their own, or as part of deleting their account. */
    action: z.literal("workspace.member_left"),
    target: target("user"),
    metadata: z.object({ role: role.optional() }).strict().default({}),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.invitation_created"),
    target: target("invitation"),
    metadata: z.object({ email: z.email().max(ID_MAX), role }).strict(),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.invitation_accepted"),
    target: target("invitation"),
    metadata: z.object({ role }).strict(),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.invitation_revoked"),
    target: target("invitation"),
    metadata: noMetadata,
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.member_role_changed"),
    target: target("user"),
    metadata: z.object({ previousRole: role, role }).strict(),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.member_removed"),
    target: target("user"),
    metadata: z.object({ role: role.optional() }).strict().default({}),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.ownership_transferred"),
    target: target("workspace"),
    metadata: z.object({ previousOwnerUserId: id, ownerUserId: id }).strict(),
  }),
  z.object({
    ...inWorkspace,
    /** An admin gave a workspace without an owner a new one (the target). */
    action: z.literal("workspace.owner_assigned"),
    target: target("user"),
    metadata: z.object({ previousRole: role.nullable() }).strict(),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("workspace.deleted"),
    target: target("workspace"),
    metadata: noMetadata,
  }),

  // Notifications (recorded by the notifications use cases). Reads, archiving and delivery
  // are the recipient's own inbox state and are not recorded.
  z.object({
    ...common,
    action: z.literal("notifications.preferences_changed"),
    target: target("user"),
    metadata: z
      .object({
        /** How many channel switches the request set. */
        changes: z.number().int().min(0).max(100),
        emailCadence: z.enum(["instant", "daily"]).optional(),
      })
      .strict(),
  }),
  z.object({
    ...common,
    /** One-click unsubscribe from a mail's link (RFC 8058); the token names the user. */
    action: z.literal("notifications.unsubscribed"),
    target: target("user"),
    metadata: z
      .object({
        /** The notification type, or "*" for every type (a digest's link). */
        type: text,
        channel: z.literal("email"),
      })
      .strict(),
  }),

  // Feature flags (platform configuration, recorded by the flag admin use cases). The
  // target id is the flag key; values are flag values (boolean, short string, number).
  z.object({
    ...common,
    action: z.literal("feature_flag.updated"),
    target: target("feature_flag"),
    metadata: z
      .object({ enabled: z.boolean(), fallthrough: flagValue.nullable() })
      .strict(),
  }),
  z.object({
    ...common,
    action: z.literal("feature_flag.rules_changed"),
    target: target("feature_flag"),
    metadata: z
      .object({
        ruleCount: z.number().int().min(0).max(50),
        ruleKinds: z.array(z.enum(["workspace", "plan", "percentage"])).max(50),
      })
      .strict(),
  }),

  // Trash (recorded by the entities' "move to trash" use cases and the trash use cases).
  z.object({
    ...inWorkspace,
    action: z.literal("trash.item_trashed"),
    target: trashTarget,
    metadata: z.object({ entityType: trashEntityType }).strict(),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("trash.item_restored"),
    target: trashTarget,
    metadata: z.object({ entityType: trashEntityType }).strict(),
  }),
  z.object({
    ...inWorkspace,
    /** Deleted for good; `retention` purges are the system's, the others a member's. */
    action: z.literal("trash.item_purged"),
    target: trashTarget,
    metadata: z
      .object({
        entityType: trashEntityType,
        reason: z.enum(["manual", "empty_trash", "retention"]),
      })
      .strict(),
  }),

  // Billing (recorded by the billing use cases; the target is the subscribing workspace).
  z.object({
    ...inWorkspace,
    /** A new workspace started on the catalog's NEW_WORKSPACE_PLAN_ID. */
    action: z.literal("billing.trial_started"),
    target: target("workspace"),
    metadata: z
      .object({ planId: catalogId, trialEndsAt: z.iso.datetime().nullable() })
      .strict(),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("billing.plan_assigned"),
    target: target("workspace"),
    metadata: z
      .object({
        previousPlanId: catalogId.nullable(),
        planId: catalogId,
        status: subscriptionStatus,
      })
      .strict(),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("billing.addons_set"),
    target: target("workspace"),
    metadata: z
      .object({
        addons: z
          .array(
            z
              .object({
                addonId: catalogId,
                quantity: z.number().int().positive(),
              })
              .strict()
          )
          .max(50),
      })
      .strict(),
  }),
  z.object({
    ...inWorkspace,
    action: z.literal("billing.override_set"),
    target: target("workspace"),
    metadata: z
      .object({
        key: catalogId,
        /** `removed`: the override was deleted. */
        kind: z.enum(["feature", "limit", "removed"]),
        enabled: z.boolean().optional(),
        /** null is unlimited. */
        limit: z.number().int().nonnegative().nullable().optional(),
        reason: text,
      })
      .strict(),
  }),
  z.object({
    ...inWorkspace,
    /** A trial ended, or a past-due or canceled subscription lapsed to its fallback plan. */
    action: z.literal("billing.plan_lapsed"),
    target: target("workspace"),
    metadata: z
      .object({
        previousPlanId: catalogId,
        planId: catalogId,
        reason: z.enum(["trial_ended", "past_due_grace_ended", "period_ended"]),
      })
      .strict(),
  }),
  z.object({
    ...inWorkspace,
    /** Applied from the billing provider's webhook. */
    action: z.literal("billing.subscription_changed"),
    target: target("workspace"),
    metadata: z
      .object({
        previousPlanId: catalogId.nullable(),
        planId: catalogId,
        status: subscriptionStatus,
        provider: z.string().min(1).max(50),
      })
      .strict(),
  }),
]);

/** What a caller passes to recordAuditEvent (defaults not yet applied). */
export type AuditEventInput = z.input<typeof auditEventSchema>;
/** A validated event, defaults applied. */
export type ParsedAuditEvent = z.output<typeof auditEventSchema>;
export type AuditAction = ParsedAuditEvent["action"];

/** Every action in the catalog. */
export const AUDIT_ACTIONS: readonly AuditAction[] =
  auditEventSchema.options.map((option) => option.shape.action.value);
