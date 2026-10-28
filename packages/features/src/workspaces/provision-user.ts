import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  CREATOR_ROLE,
  DEFAULT_MEMBER_ROLE,
  decideSignUp,
  PERSONAL_WORKSPACE_NAME,
  type Role,
  SINGLE_WORKSPACE_ID,
  type WorkspaceSettings,
} from "./domain";
import { workspaceMembers, workspaces } from "./workspaces.schema";

/**
 * Gives a new user their workspace, right after Better Auth creates them.
 * - personal and multi: a personal workspace they own.
 * - single: membership in the app's one workspace (created by the first sign-up) for
 *   those the settings let in on their own: the bootstrap admin as owner, everyone with
 *   SIGN_UP=open and the SIGN_UP_DOMAINS as members. Someone let in only by a pending
 *   invitation joins by accepting it through its link (the token proves they received
 *   the mail; their email address alone is not verified), so they get no membership here.
 */
export async function provisionUser(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: {
    readonly user: { readonly id: string; readonly email: string };
    readonly settings: WorkspaceSettings;
    /** Name of the single-mode workspace when the first sign-up creates it. */
    readonly sharedWorkspaceName: string;
  }
): Promise<{
  readonly workspaceId: string | null;
  readonly role: Role | null;
}> {
  const now = deps.clock.now();

  if (input.settings.mode !== "single") {
    const workspaceId = deps.ids.uuid();
    await deps.db.batch([
      deps.db.insert(workspaces).values({
        id: workspaceId,
        name: PERSONAL_WORKSPACE_NAME,
        kind: "personal",
        createdBy: input.user.id,
      }),
      deps.db.insert(workspaceMembers).values({
        workspaceId,
        userId: input.user.id,
        role: CREATOR_ROLE,
        lastActiveAt: now,
      }),
    ]);
    await recordAuditEvent(deps, deps.requestContext, {
      action: "workspace.created",
      actor: { kind: "user", userId: input.user.id },
      workspaceId,
      target: { type: "workspace", id: workspaceId },
      metadata: { kind: "personal" },
    });
    return { workspaceId, role: CREATOR_ROLE };
  }

  const letIn = decideSignUp({
    mode: input.settings.mode,
    policy: input.settings.signUp,
    allowedDomains: input.settings.signUpDomains,
    bootstrapAdminEmail: input.settings.bootstrapAdminEmail,
    email: input.user.email,
    hasPendingInvitation: false,
  });
  const role: Role | null = !letIn.allowed
    ? null
    : letIn.reason === "bootstrap"
      ? CREATOR_ROLE
      : DEFAULT_MEMBER_ROLE;

  const createWorkspace = deps.db
    .insert(workspaces)
    .values({
      id: SINGLE_WORKSPACE_ID,
      name: input.sharedWorkspaceName,
      kind: "shared",
      createdBy: input.user.id,
    })
    .onConflictDoNothing();
  if (!role) {
    await createWorkspace;
    return { workspaceId: null, role: null };
  }
  await deps.db.batch([
    createWorkspace,
    deps.db
      .insert(workspaceMembers)
      .values({
        workspaceId: SINGLE_WORKSPACE_ID,
        userId: input.user.id,
        role,
        lastActiveAt: now,
      })
      .onConflictDoNothing(),
  ]);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.member_joined",
    actor: { kind: "user", userId: input.user.id },
    workspaceId: SINGLE_WORKSPACE_ID,
    target: { type: "user", id: input.user.id },
    metadata: { role },
  });
  return { workspaceId: SINGLE_WORKSPACE_ID, role };
}
