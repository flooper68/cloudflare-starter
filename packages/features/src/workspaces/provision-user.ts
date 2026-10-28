import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { BillingGate, Clock, Ids, RequestContext } from "../kernel";
import type { ProductAnalytics } from "../platform";
import { trackEvent } from "../product-analytics";
import {
  CREATOR_ROLE,
  DEFAULT_MEMBER_ROLE,
  decideSignUp,
  memberJoinedEvent,
  PERSONAL_WORKSPACE_NAME,
  personalWorkspaceId,
  type Role,
  SINGLE_WORKSPACE_ID,
  type WorkspaceSettings,
  workspaceCreatedEvent,
} from "./domain";
import { identifyMember } from "./identify-member";
import { workspaceMembers, workspaces } from "./workspaces.schema";

/**
 * Gives a new user their workspace, right after Better Auth creates them.
 * - personal and multi: a personal workspace they own (idempotent; resolveActor calls it
 *   again for a user whose sign-up provisioning failed).
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
    readonly analytics: ProductAnalytics;
    /** Starts a new workspace's plan (billing's trial). */
    readonly billing: BillingGate;
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
    // Idempotent: the id is derived from the user, so a second run (resolveActor healing a
    // failed sign-up provisioning, or two at once) creates and audits nothing new.
    const workspaceId = personalWorkspaceId(input.user.id);
    const [created] = await deps.db.batch([
      deps.db
        .insert(workspaces)
        .values({
          id: workspaceId,
          name: PERSONAL_WORKSPACE_NAME,
          kind: "personal",
          createdBy: input.user.id,
        })
        .onConflictDoNothing()
        .returning({ id: workspaces.id }),
      deps.db
        .insert(workspaceMembers)
        .values({
          workspaceId,
          userId: input.user.id,
          role: CREATOR_ROLE,
          lastActiveAt: now,
        })
        .onConflictDoNothing(),
    ]);
    if (created.length === 0) return { workspaceId, role: CREATOR_ROLE };
    await recordAuditEvent(deps, deps.requestContext, {
      action: "workspace.created",
      actor: { kind: "user", userId: input.user.id },
      workspaceId,
      target: { type: "workspace", id: workspaceId },
      metadata: { kind: "personal" },
    });
    trackEvent(
      deps,
      { ...deps.requestContext, userId: input.user.id, workspaceId },
      workspaceCreatedEvent,
      { kind: "personal" }
    );
    await deps.billing.workspaceCreated(workspaceId);
    // After billing started the plan, so the traits carry it.
    await identifyMember(deps, {
      userId: input.user.id,
      workspaceId,
      role: CREATOR_ROLE,
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
    .onConflictDoNothing()
    .returning({ id: workspaces.id });
  // The first sign-up creates the app's workspace: its plan starts and it is tracked once,
  // like a personal one.
  const workspaceStarted = async (created: readonly { id: string }[]) => {
    if (created.length === 0) return;
    await deps.billing.workspaceCreated(SINGLE_WORKSPACE_ID);
    trackEvent(
      deps,
      {
        ...deps.requestContext,
        userId: input.user.id,
        workspaceId: SINGLE_WORKSPACE_ID,
      },
      workspaceCreatedEvent,
      { kind: "shared" }
    );
  };
  if (!role) {
    await workspaceStarted(await createWorkspace);
    return { workspaceId: null, role: null };
  }
  const [created] = await deps.db.batch([
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
  await workspaceStarted(created);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.member_joined",
    actor: { kind: "user", userId: input.user.id },
    workspaceId: SINGLE_WORKSPACE_ID,
    target: { type: "user", id: input.user.id },
    metadata: { role },
  });
  const actor = {
    userId: input.user.id,
    workspaceId: SINGLE_WORKSPACE_ID,
    role,
  };
  trackEvent(deps, { ...deps.requestContext, ...actor }, memberJoinedEvent, {
    role,
    via: "sign_up",
  });
  await identifyMember(deps, actor);
  return { workspaceId: SINGLE_WORKSPACE_ID, role };
}
