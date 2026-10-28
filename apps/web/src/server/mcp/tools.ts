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
  direct(
    "list_files",
    "read",
    "storage.listFiles",
    "List files",
    "Lists the files of the workspace, newest first: id, filename, content type, size, upload time."
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
    "Creates a file record in the workspace and returns a presigned PUT URL for uploading up to 10 MB. Upload with an HTTP PUT and the same Content-Type."
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
];

/** Procedures deliberately not exposed to MCP, with the reason. Keep it empty if you can. */
export const MCP_EXEMPT_PROCEDURES: Readonly<Record<string, string>> = {};

/**
 * HTTP endpoints under src/pages that are not tRPC, relative to src/pages, with the reason
 * they need no MCP tool. A new endpoint fails the parity test until it is listed here or
 * moved behind a tRPC procedure (and so a tool).
 */
export const NON_TRPC_ROUTES: Readonly<Record<string, string>> = {
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
