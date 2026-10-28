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
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

const ID_MAX = 320;
const TEXT_MAX = 200;

const id = z.string().min(1).max(ID_MAX);
const text = z.string().min(1).max(TEXT_MAX);
const role = z.string().min(1).max(64);

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
const signUpMethod = z.enum(["password", "social", "other"]);

export const auditEventSchema = z.discriminatedUnion("action", [
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

  // Workspaces (recorded by the workspace use cases).
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
    action: z.literal("workspace.deleted"),
    target: target("workspace"),
    metadata: noMetadata,
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
