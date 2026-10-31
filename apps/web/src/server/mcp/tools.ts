/**
 * MCP tools. Each tool is a thin adapter over one or more tRPC procedures, called
 * in-process through `createCaller` as the user of the access token: same Zod input,
 * same auth check, same errors as the web app. Nothing here holds business logic.
 *
 * Rule (enforced by parity.test.ts): every tRPC procedure is reachable through a tool
 * or listed in MCP_EXEMPT_PROCEDURES with a reason, and every other HTTP route is
 * listed in NON_TRPC_ROUTES with a reason.
 */
import type { AnyProcedure } from "@trpc/server";
import { z } from "zod";

import { appRouter } from "@/server/trpc/router";

export type Caller = ReturnType<typeof appRouter.createCaller>;
export type ToolKind = "read" | "write";

export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  /** Written for the model: what it does, when to use it. */
  readonly description: string;
  readonly kind: ToolKind;
  /** The tRPC procedures the tool fronts (parity test). */
  readonly procedures: readonly string[];
  readonly input: z.ZodObject;
  /** Sends something outside the app (mail, money, a message): ask the user first. */
  readonly outward?: boolean;
  /** Removes access or data that cannot be restored by calling it again: ask first. */
  readonly destructive?: boolean;
  readonly run: (
    caller: Caller,
    args: Record<string, unknown>
  ) => Promise<unknown>;
}

const procedures = appRouter._def.procedures as unknown as Record<
  string,
  AnyProcedure
>;

export const PROCEDURE_PATHS: readonly string[] = Object.keys(procedures);

/** Calls a procedure of the caller by its path, e.g. `storage.listFiles`. */
export function invoke(
  caller: Caller,
  path: string,
  input?: unknown
): Promise<unknown> {
  const fn = path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown>)[key],
      caller
    );
  return (fn as (input: unknown) => Promise<unknown>)(input);
}

/**
 * The Zod input object of a procedure (`{}` when it takes no input). Chained inputs
 * (`workspaceProcedure.input(...)` adds to `workspaceInput`) are merged like tRPC merges
 * them; a later input's key wins (`workspace.switch` makes `workspaceId` required).
 */
export function procedureInput(path: string): z.ZodObject {
  const procedure = procedures[path];
  if (!procedure) throw new Error(`Unknown procedure ${path}`);
  const inputs = (procedure._def as unknown as { inputs: unknown[] }).inputs;
  let shape: z.ZodRawShape = {};
  for (const input of inputs) {
    let schema = input as z.ZodType;
    while (schema instanceof z.ZodOptional)
      schema = schema.unwrap() as z.ZodType;
    if (!(schema instanceof z.ZodObject)) {
      throw new Error(`Procedure ${path} has no object input`);
    }
    shape = { ...shape, ...schema.shape };
  }
  return z.object(shape);
}

/** A tool that calls exactly one procedure with its arguments as the input. */
function direct(
  name: string,
  kind: ToolKind,
  path: string,
  title: string,
  description: string,
  extra: Pick<ToolDefinition, "outward" | "destructive"> = {}
): ToolDefinition {
  return {
    name,
    title,
    description,
    kind,
    procedures: [path],
    input: procedureInput(path),
    // Always an object: MCP clients send `{}` for no arguments, and procedures
    // without input ignore it.
    run: (caller, args) => invoke(caller, path, args),
    ...extra,
  };
}

export const MCP_TOOLS: readonly ToolDefinition[] = [
  direct(
    "get_security_status",
    "read",
    "account.security.status",
    "Security status",
    "Reads your factor enrollment and this connection's verification status, without secrets or recovery codes. Configure factors in the browser."
  ),
  direct(
    "get_account_settings",
    "read",
    "account.settings.get",
    "Account settings",
    "The current person\u2019s theme, time zone, locale and custom avatar URL."
  ),
  direct(
    "update_account_settings",
    "write",
    "account.settings.update",
    "Update account settings",
    "Set the current person\u2019s theme, valid IANA time zone and supported locale."
  ),
  direct(
    "list_sessions",
    "read",
    "account.sessions.list",
    "List sessions",
    "The current person\u2019s active browser sessions with opaque ids and device details. Never returns credentials."
  ),
  direct(
    "revoke_session",
    "write",
    "account.sessions.revoke",
    "Sign out a session",
    "Sign out one of the current person\u2019s sessions by id from list_sessions. Confirm with the person first.",
    { destructive: true }
  ),
  direct(
    "remove_avatar",
    "write",
    "account.removeAvatar",
    "Remove avatar",
    "Remove the current person\u2019s custom avatar."
  ),
  direct(
    "get_workspace_settings",
    "read",
    "workspace.settings",
    "Workspace settings",
    "Name, kind and current logo URL of a workspace the person belongs to."
  ),
  direct(
    "update_workspace",
    "write",
    "workspace.update",
    "Update workspace",
    "Rename a workspace. Owners only."
  ),
  direct(
    "delete_workspace",
    "write",
    "workspace.delete",
    "Delete workspace",
    "Delete a shared workspace in multi mode, with its files and memberships. Owners only; confirmName must exactly match its name. Confirm with the person first.",
    { destructive: true }
  ),
  direct(
    "remove_workspace_logo",
    "write",
    "workspace.removeLogo",
    "Remove workspace logo",
    "Remove the current workspace\u2019s logo. Owners only."
  ),

  direct(
    "admin_storage_status",
    "read",
    "admin.storage.status",
    "Storage maintenance settings",
    "Platform admins only. Read the reconciliation mode and grace period."
  ),
  direct(
    "admin_reconcile_storage",
    "write",
    "admin.storage.reconcile",
    "Inspect dangling storage",
    "Platform admins only. Queue a report-only check for old unreferenced files and avatars. Never deletes. Returns run and job ids; inspect audit/logs for the result."
  ),
  direct(
    "admin_delete_storage_orphans",
    "write",
    "admin.storage.deleteOrphans",
    "Delete dangling storage",
    "Platform admins only, with recent sign-in and STORAGE_RECONCILE=delete. Queues permanent removal of old unreferenced objects. Confirm with the user before calling. Inspect a report first.",
    { destructive: true }
  ),
  direct(
    "ping",
    "read",
    "public.hello",
    "Ping",
    "Checks that the app answers. Returns a hello message."
  ),
  direct(
    "whoami",
    "read",
    "health.hello",
    "Who am I",
    "Returns the signed-in user's email and the app environment (develop, staging, production)."
  ),
  direct(
    "list_workspaces",
    "read",
    "workspace.list",
    "List workspaces",
    "Lists the workspaces the user belongs to (id, name, kind, the user's role), the app's workspace mode (personal, single, multi) and which workspace is current. Workspace tools act in the current workspace unless given a workspaceId."
  ),
  direct(
    "create_workspace",
    "write",
    "workspace.create",
    "Create workspace",
    "Creates a shared workspace with the user as owner and makes it current. Only in multi mode; otherwise FORBIDDEN."
  ),
  direct(
    "switch_workspace",
    "write",
    "workspace.switch",
    "Switch workspace",
    "Makes a workspace the user's current one, for the web app and for tools called without workspaceId. Only in multi mode."
  ),
  direct(
    "leave_workspace",
    "write",
    "workspace.leave",
    "Leave workspace",
    "The user leaves a workspace and loses access to its data. The last owner cannot leave (transfer ownership first); a personal workspace cannot be left. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "transfer_ownership",
    "write",
    "workspace.transferOwnership",
    "Transfer ownership",
    "Makes another member (by userId, see list_members) the owner of the workspace; the user becomes a member. Owners only. Confirm with the user before calling."
  ),
  direct(
    "list_members",
    "read",
    "workspace.members.list",
    "List members",
    "Lists the members of a workspace: userId, name, email, role, when they joined. Not available in personal mode."
  ),
  direct(
    "change_member_role",
    "write",
    "workspace.members.changeRole",
    "Change member role",
    "Gives a member (by userId) another role. Owners only; the last owner cannot be demoted."
  ),
  direct(
    "remove_member",
    "write",
    "workspace.members.remove",
    "Remove member",
    "Removes a member (by userId) from the workspace; they lose access to its data. Owners only; the last owner cannot be removed. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "list_invitations",
    "read",
    "workspace.invitations.list",
    "List invitations",
    "Lists open invitations of the workspace: id, email, role, status (pending or expired), expiry. Owners only."
  ),
  direct(
    "invite_member",
    "write",
    "workspace.invitations.create",
    "Invite member",
    "Emails an invitation link (valid 7 days) to join the workspace with a role. A pending invitation for the same email is replaced. Owners only. Confirm the email address and role with the user before calling.",
    { outward: true }
  ),
  direct(
    "revoke_invitation",
    "write",
    "workspace.invitations.revoke",
    "Revoke invitation",
    "Revokes an open invitation by id (see list_invitations); its link stops working. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "preview_invitation",
    "read",
    "workspace.invitations.preview",
    "Preview invitation",
    "Shows what an invitation link's token is for: workspace name, who invited, the invited email, role and status (pending, accepted, revoked, expired)."
  ),
  direct(
    "accept_invitation",
    "write",
    "workspace.invitations.accept",
    "Accept invitation",
    "Accepts an invitation by the token from its link (the part after /invite/) and joins the workspace, making it current. The invitation must be pending and sent to the user's email."
  ),
  {
    name: "list_notifications",
    title: "List notifications",
    description:
      "Lists the user's notifications, newest first (id, type, title, body, link, workspace, created, read and archived times), and the unread count. view: inbox (not archived), unread, or archived. Page with limit and nextCursor.",
    kind: "read",
    procedures: ["notifications.list", "notifications.unreadCount"],
    input: procedureInput("notifications.list"),
    run: async (caller, args) => {
      const [page, unread] = await Promise.all([
        invoke(caller, "notifications.list", args),
        invoke(caller, "notifications.unreadCount"),
      ]);
      return {
        ...(page as object),
        unread: (unread as { count: number }).count,
      };
    },
  },
  direct(
    "mark_notifications_read",
    "write",
    "notifications.markRead",
    "Mark notifications read",
    "Marks the user's notifications read: the given ids, or all: true for every unread one (optionally only those about one workspaceId). Returns how many changed."
  ),
  direct(
    "archive_notifications",
    "write",
    "notifications.archive",
    "Archive notifications",
    "Archives the user's notifications by id: they leave the inbox (still listed with view archived) and count as read."
  ),
  direct(
    "get_notification_preferences",
    "read",
    "notifications.preferences.get",
    "Get notification preferences",
    "Returns the user's notification preferences: per notification type its in-app and email switches (security notifications are locked on), the email cadence (instant or daily digest), and whether this deployment sends email."
  ),
  direct(
    "update_notification_preferences",
    "write",
    "notifications.preferences.update",
    "Update notification preferences",
    "Turns notification channels on or off per type (changes: [{ type, channel: inApp|email, enabled }]) and sets the email cadence (instant or daily). Security notifications cannot be turned off. Confirm with the user before turning email off."
  ),
  direct(
    "get_billing_summary",
    "read",
    "workspace.billing.summary",
    "Get billing summary",
    "Shows the workspace's plan, subscription status, trial end, included features, add-ons and usage of each metric against its limit (null is unlimited). With billing off the plan is unlimited. Use it to explain a limit_reached error."
  ),
  direct(
    "get_checkout_url",
    "write",
    "workspace.billing.checkoutUrl",
    "Get checkout URL",
    "Returns a payment provider checkout page where the user buys a plan (and optional add-ons) for the workspace. Owners only; needs online billing (otherwise PRECONDITION_FAILED). Confirm the plan with the user before calling; the user completes payment themselves.",
    { outward: true }
  ),
  direct(
    "get_billing_portal_url",
    "write",
    "workspace.billing.portalUrl",
    "Get billing portal URL",
    "Returns the payment provider's customer portal (invoices, payment method, cancellation) for the workspace. Owners only; needs online billing and a completed checkout. Confirm with the user before calling.",
    { outward: true }
  ),
  direct(
    "admin_get_workspace_billing",
    "read",
    "admin.billing.get",
    "Admin: get workspace billing",
    "Platform admins only: a workspace's subscription, add-ons, entitlement overrides and the resulting features and limits. Others get NOT_FOUND."
  ),
  direct(
    "admin_get_workspace_usage",
    "read",
    "admin.billing.usage",
    "Admin: get workspace usage",
    "Platform admins only: a workspace's usage of each metric against its limit, this month for counters. Others get NOT_FOUND."
  ),
  direct(
    "admin_assign_plan",
    "write",
    "admin.billing.assignPlan",
    "Admin: assign plan",
    "Platform admins only: puts a workspace on a plan, active or trialing until trialEndsAt (ISO 8601). With online billing the provider's next event overrides it. Confirm the workspace and plan with the user before calling."
  ),
  direct(
    "admin_set_addons",
    "write",
    "admin.billing.setAddons",
    "Admin: set add-ons",
    "Platform admins only: replaces a workspace's add-ons with the given list (addonId, quantity); an empty list removes them all. Confirm with the user before calling."
  ),
  direct(
    "admin_set_override",
    "write",
    "admin.billing.setOverride",
    "Admin: set entitlement override",
    "Platform admins only: an exception for one workspace that wins over its plan: grant or revoke a feature (kind feature, enabled), or set a metric's limit (kind limit, limit; null is unlimited). override null removes it. A reason is required and audited. Confirm with the user before calling."
  ),
  direct(
    "list_files",
    "read",
    "storage.listFiles",
    "List files",
    "Lists the files of the workspace, newest first: id, filename, content type, size, upload time. Files in the trash are not listed (see list_trash)."
  ),
  direct(
    "get_download_url",
    "read",
    "storage.getDownloadUrl",
    "Get download URL",
    "Returns a presigned URL (valid 1 hour) to download a file of the workspace by id. Needs R2 presigned URLs configured; otherwise it fails with PRECONDITION_FAILED."
  ),
  direct(
    "create_upload_url",
    "write",
    "storage.createUpload",
    "Create upload URL",
    "Creates a file record in the workspace and returns a presigned PUT URL for uploading up to 10 MB. Upload with an HTTP PUT and the same Content-Type. Needs a plan with direct uploads (files.presigned_upload) and room in the storage and monthly upload limits; otherwise FORBIDDEN with domain.kind limit_reached."
  ),
  direct(
    "delete_file",
    "write",
    "storage.deleteFile",
    "Move file to trash",
    "Moves a file of the workspace (by id, see list_files) to the trash: it leaves the file list and downloads at once and is deleted for good after 30 days. Restorable with restore_from_trash until then. Members and owners."
  ),
  direct(
    "list_trash",
    "read",
    "trash.list",
    "List trash",
    "Lists what is in the workspace's trash, most recently deleted first: type (file), id, label, size, when and by whom it was deleted, and purgeAt (when it is deleted for good). Optional type filter; page with cursor (nextCursor) and limit (up to 100). can.restore and can.purge say what the user may do."
  ),
  direct(
    "restore_from_trash",
    "write",
    "trash.restore",
    "Restore from trash",
    "Restores items (1 to 100, each { type, id } from list_trash) from the workspace's trash to where they were. All or nothing: NOT_FOUND if any item is not in this trash."
  ),
  direct(
    "delete_from_trash_permanently",
    "write",
    "trash.deletePermanently",
    "Delete from trash permanently",
    "Deletes items (1 to 100, each { type, id } from list_trash) from the workspace's trash for good, with their stored bytes. Cannot be undone. Owners only. Confirm the items with the user before calling.",
    { destructive: true }
  ),
  direct(
    "empty_trash",
    "write",
    "trash.empty",
    "Empty trash",
    "Deletes everything in the workspace's trash for good, up to 1000 items per call: call again while remaining is true. Cannot be undone. Owners only. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "enqueue_hello",
    "write",
    "queue.enqueueHello",
    "Enqueue hello",
    "Sends a hello message with the given name to the background queue (demo of a queued job)."
  ),
  direct(
    "send_test_email",
    "write",
    "email.sendTest",
    "Send test email",
    "Sends a test email to the signed-in user's own address. Confirm with the user before calling.",
    { outward: true }
  ),
  direct(
    "get_client_flags",
    "read",
    "flags.client",
    "Get client feature flags",
    "Returns the values of the feature flags the web app reads for the signed-in user in a workspace (release and operations switches, keyed by flag name)."
  ),
  direct(
    "list_feature_flags",
    "read",
    "admin.flags.list",
    "List feature flags",
    "Platform admins only. Lists every feature flag in the catalog (type, default, owner, removal condition) with its stored switch, fallthrough value and targeting rules."
  ),
  direct(
    "update_feature_flag",
    "write",
    "admin.flags.update",
    "Update feature flag",
    "Platform admins only. Turns a catalog feature flag on or off and sets its fallthrough value (null for the catalog default). Changes what users see within 30 seconds: confirm with the user before calling."
  ),
  direct(
    "set_feature_flag_rules",
    "write",
    "admin.flags.setRules",
    "Set feature flag rules",
    "Platform admins only. Replaces a feature flag's ordered targeting rules: workspace (workspaceId), plan (planId) or percentage (percentageBp, 0-10000 basis points); the first matching rule's value wins. Changes what users see within 30 seconds: confirm with the user before calling."
  ),

  // Admin portal: only for platform admins with ADMIN_PORTAL=on; everyone else gets
  // NOT_FOUND. Destructive ones also need a sign-in from the last 15 minutes
  // (FORBIDDEN, appCode REAUTH_REQUIRED: ask the admin to sign in to the web app again).
  direct(
    "admin_get_overview",
    "read",
    "admin.overview.get",
    "Admin: overview",
    "Platform admins only. Returns user counts (total, admins, suspended), daily sign-ups and daily active users for the last 30 days, and workspace counts and sizes."
  ),
  direct(
    "admin_get_settings",
    "read",
    "admin.settings.get",
    "Admin: deployment settings",
    "Platform admins only. Returns this environment's settings, read-only: workspace mode, sign-up policy and domains, bootstrap admin email, sign-in methods, email verification, email, ADMIN_PORTAL."
  ),
  direct(
    "admin_list_users",
    "read",
    "admin.users.list",
    "Admin: list users",
    "Platform admins only. Lists every user of the app, newest first: id, name, email, verified, role (user or admin), suspended, created and last seen. Filters: search (name or email), role, status (active or banned); pages with cursor (nextCursor) and limit."
  ),
  direct(
    "admin_get_user",
    "read",
    "admin.users.get",
    "Admin: user detail",
    "Platform admins only. One user by id: profile, verification, suspension, sign-in methods, workspaces with roles, and open sessions (no tokens)."
  ),
  direct(
    "admin_ban_user",
    "write",
    "admin.users.ban",
    "Admin: suspend user",
    "Platform admins only. Suspends a user (by userId) until expiresAt or for good, with an optional reason, and signs them out everywhere. Not yourself, never the last admin. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "admin_unban_user",
    "write",
    "admin.users.unban",
    "Admin: lift suspension",
    "Platform admins only. Lifts a user's suspension (by userId) so they can sign in again."
  ),
  direct(
    "admin_revoke_user_sessions",
    "write",
    "admin.users.revokeSessions",
    "Admin: sign user out",
    "Platform admins only. Signs a user (by userId) out of every session. Not yourself. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "admin_set_user_role",
    "write",
    "admin.users.setRole",
    "Admin: set platform role",
    "Platform admins only. Makes a user (by userId) an admin or a regular user. Not your own role; the last admin cannot be demoted. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "admin_remove_user",
    "write",
    "admin.users.remove",
    "Admin: delete user",
    "Platform admins only. Deletes a user's account (by userId): their own workspaces and files go with it, they leave shared ones. Refused while they are the last owner of a shared workspace (assign another owner first). Cannot be undone. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "admin_send_password_reset",
    "write",
    "admin.users.sendPasswordReset",
    "Admin: send password reset",
    "Platform admins only. Emails a user (by userId) a password reset link; the link is never returned. Confirm with the user before calling.",
    { outward: true }
  ),
  direct(
    "admin_list_workspaces",
    "read",
    "admin.workspaces.list",
    "Admin: list workspaces",
    "Platform admins only, not in personal mode. Lists every workspace, newest first: id, name, kind, member count, manager (owner) count; 0 managers means it needs an owner. Filters: search, kind; pages with cursor and limit."
  ),
  direct(
    "admin_get_workspace",
    "read",
    "admin.workspaces.get",
    "Admin: workspace detail",
    "Platform admins only, not in personal mode. One workspace by id: members with roles, manager count, pending invitations."
  ),
  direct(
    "admin_assign_workspace_owner",
    "write",
    "admin.workspaces.assignOwner",
    "Admin: assign workspace owner",
    "Platform admins only, not in personal mode. Makes a user (by userId) the owner of a workspace that has no owner, adding them if needed. Refused while it has an owner. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "admin_delete_workspace",
    "write",
    "admin.workspaces.delete",
    "Admin: delete workspace",
    "Platform admins only, not in personal mode. Deletes a shared workspace (by workspaceId) with its files, members and invitations. Cannot be undone. Confirm with the user before calling.",
    { destructive: true }
  ),
  direct(
    "admin_list_audit_events",
    "read",
    "admin.audit.list",
    "Admin: audit log",
    "Platform admins only. Audit events newest first: action, outcome, actor, target, workspace, time, trace id. Filters: actorUserId, action, targetType (+ targetId), workspaceId, from/to (ISO 8601); pages with cursor and limit."
  ),
];

/** Procedures deliberately not exposed to MCP, with the reason. Keep it empty if you can. */
export const MCP_EXEMPT_PROCEDURES: Readonly<Record<string, string>> = {
  "admin.users.resetSecondFactor":
    "Recovery resets authentication and is deliberately browser-only with fresh administrator assurance.",
  "analytics.track": "client telemetry, not an agent capability",
  "admin.impersonation.start":
    "creates a browser cookie session; an MCP client has no browser session to swap",
  "admin.impersonation.stop":
    "creates a browser cookie session (restores the admin's); only an impersonated browser session can call it",
};

/**
 * HTTP endpoints under src/pages that are not tRPC, relative to src/pages, with the reason
 * they need no MCP tool. A new endpoint fails the parity test until it is listed here or
 * moved behind a tRPC procedure (and so a tool).
 */
export const NON_TRPC_ROUTES: Readonly<Record<string, string>> = {
  "api/workspaces/[workspaceId]/logo/[version].ts":
    "Authenticated binary image transfer; agents read settings and can remove the current avatar/logo through tools",
  "api/workspaces/[workspaceId]/logo/index.ts":
    "Authenticated binary image transfer; agents read settings and can remove the current avatar/logo through tools",
  "api/account/avatar/[version].ts":
    "Authenticated binary image transfer; agents read settings and can remove the current avatar/logo through tools",
  "api/account/avatar/index.ts":
    "Authenticated binary image transfer; agents read settings and can remove the current avatar/logo through tools",
  "api/auth/[...all].ts":
    "Better Auth handler; MCP clients use it as their OAuth server",
  "api/trpc/[...trpc].ts": "the tRPC endpoint the tools call in-process",
  "api/hello.ts": "public REST example; tool ping returns the same",
  "api/files/index.ts":
    "binary upload through the Worker; MCP clients use create_upload_url",
  "api/files/[id].ts":
    "binary download through the Worker; MCP clients use list_files and get_download_url",
  ".well-known/[...path].ts": "OAuth discovery documents for MCP clients",
  "mcp.ts": "the MCP endpoint itself",
  "api/notifications/unsubscribe.ts":
    "one-click unsubscribe from a mail link (RFC 8058), authorized by its signed token, not a user; MCP clients use update_notification_preferences",
  "api/billing/webhook.ts":
    "the billing provider's webhook (signed server-to-server events); people and agents use get_billing_summary",
};

export function annotationsOf(tool: ToolDefinition) {
  return tool.kind === "read"
    ? {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      }
    : {
        readOnlyHint: false,
        destructiveHint: tool.destructive ?? false,
        idempotentHint: false,
        openWorldHint: tool.outward ?? false,
      };
}
