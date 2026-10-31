import {
  acceptInvitation,
  addonGrantSchema,
  changeMemberRole,
  createCheckoutUrl,
  createInvitation,
  createPortalUrl,
  createWorkspace,
  deleteOwnWorkspace,
  deleteWorkspaceFiles,
  getBillingSummary,
  getWorkspaceSettings,
  leaveWorkspace,
  listInvitations,
  listMembers,
  listWorkspaces,
  previewInvitation,
  purgeWorkspaceLogos,
  ROLES,
  removeMember,
  removeWorkspaceLogo,
  revokeInvitation,
  switchWorkspace,
  transferOwnership,
  updateWorkspace,
} from "@cloudflare-starter/features";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  deliverAuthLinkWithoutEmail,
  EMAIL_NOT_CONFIGURED_MESSAGE,
  mayLogAuthLinks,
} from "@/server/auth-mail";

import {
  protectedProcedure,
  publicProcedure,
  router,
  workspaceProcedure,
} from "./init";

const userId = z.string().min(1).max(100);
const token = z.string().min(1).max(200);

/**
 * Workspaces, members and invitations. Procedures that act inside a workspace are
 * `workspaceProcedure`s (optional `workspaceId`, resolved to `ctx.actor`); the few that
 * act for the user across workspaces are `protectedProcedure`s, listed with a reason in
 * test/architecture/workspace-scope.test.ts.
 */
export const workspaceRouter = router({
  settings: workspaceProcedure.query(({ ctx }) =>
    getWorkspaceSettings(ctx, ctx.actor)
  ),
  update: workspaceProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(({ ctx, input }) => updateWorkspace(ctx, ctx.actor, input)),
  delete: workspaceProcedure
    .input(z.object({ confirmName: z.string().min(1).max(80) }))
    .mutation(({ ctx, input }) =>
      deleteOwnWorkspace(
        {
          ...ctx,
          purgeWorkspaceFiles: async (workspaceIds) => {
            await deleteWorkspaceFiles(ctx, { workspaceIds });
            await purgeWorkspaceLogos(ctx, { workspaceIds });
          },
        },
        ctx.actor,
        { ...input, mode: ctx.config.workspaces.mode }
      )
    ),
  removeLogo: workspaceProcedure.mutation(({ ctx }) =>
    removeWorkspaceLogo(ctx, ctx.actor)
  ),
  list: protectedProcedure.query(async ({ ctx }) => ({
    mode: ctx.config.workspaces.mode,
    ...(await listWorkspaces(ctx, { userId: ctx.user.id })),
  })),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(({ ctx, input }) =>
      createWorkspace(ctx, {
        userId: ctx.user.id,
        mode: ctx.config.workspaces.mode,
        name: input.name,
      })
    ),

  switch: workspaceProcedure
    .input(
      z.object({
        workspaceId: z
          .string()
          .min(1)
          .max(100)
          .describe("The workspace to switch to (see list_workspaces)."),
      })
    )
    .mutation(({ ctx }) =>
      switchWorkspace(ctx, ctx.actor, { mode: ctx.config.workspaces.mode })
    ),

  leave: workspaceProcedure.mutation(({ ctx }) =>
    leaveWorkspace(ctx, ctx.actor, { mode: ctx.config.workspaces.mode })
  ),

  transferOwnership: workspaceProcedure
    .input(z.object({ userId }))
    .mutation(({ ctx, input }) =>
      transferOwnership(ctx, ctx.actor, {
        mode: ctx.config.workspaces.mode,
        userId: input.userId,
      })
    ),

  members: router({
    list: workspaceProcedure.query(async ({ ctx }) => ({
      items: await listMembers(ctx, ctx.actor, {
        mode: ctx.config.workspaces.mode,
      }),
    })),

    changeRole: workspaceProcedure
      .input(z.object({ userId, role: z.enum(ROLES) }))
      .mutation(({ ctx, input }) =>
        changeMemberRole(ctx, ctx.actor, {
          mode: ctx.config.workspaces.mode,
          userId: input.userId,
          role: input.role,
        })
      ),

    remove: workspaceProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) =>
        removeMember(ctx, ctx.actor, {
          mode: ctx.config.workspaces.mode,
          userId: input.userId,
        })
      ),
  }),

  billing: router({
    summary: workspaceProcedure.query(({ ctx }) =>
      getBillingSummary({ ...ctx, settings: ctx.config.billing }, ctx.actor)
    ),

    checkoutUrl: workspaceProcedure
      .input(
        z.object({
          planId: z.string().min(1).max(100),
          addons: z.array(addonGrantSchema).max(50).default([]),
        })
      )
      .mutation(({ ctx, input }) =>
        createCheckoutUrl(
          {
            ...ctx,
            settings: ctx.config.billing,
            provider: ctx.billingProvider,
            appUrl: ctx.config.APP_URL,
          },
          ctx.actor,
          {
            planId: input.planId,
            addons: input.addons,
            customerEmail: ctx.user.email,
          }
        )
      ),

    portalUrl: workspaceProcedure.mutation(({ ctx }) =>
      createPortalUrl(
        {
          ...ctx,
          settings: ctx.config.billing,
          provider: ctx.billingProvider,
          appUrl: ctx.config.APP_URL,
        },
        ctx.actor
      )
    ),
  }),

  invitations: router({
    list: workspaceProcedure.query(async ({ ctx }) => ({
      items: await listInvitations(ctx, ctx.actor, {
        mode: ctx.config.workspaces.mode,
      }),
    })),

    create: workspaceProcedure
      .input(z.object({ email: z.email().max(254), role: z.enum(ROLES) }))
      .mutation(async ({ ctx, input }) => {
        const environment = ctx.requestContext.environment;
        // Without email a deployed environment cannot deliver the link (it is never
        // logged there): refuse before anything is written.
        if (!ctx.email.enabled && !mayLogAuthLinks(environment)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: EMAIL_NOT_CONFIGURED_MESSAGE,
          });
        }
        const { link, ...invitation } = await createInvitation(
          { ...ctx, email: ctx.email.enabled ? ctx.email.value : null },
          ctx.actor,
          {
            mode: ctx.config.workspaces.mode,
            email: input.email,
            role: input.role,
            appUrl: ctx.config.APP_URL,
          }
        );
        if (!invitation.delivered) {
          // Local development without email: the link goes to the dev log, like auth links.
          deliverAuthLinkWithoutEmail(
            { logger: ctx.logger, environment },
            {
              subject: "Workspace invitation",
              to: invitation.email,
              url: link,
            }
          );
        }
        // The link is a credential for the invitee; callers never get it back.
        return invitation;
      }),

    revoke: workspaceProcedure
      .input(z.object({ invitationId: z.string().min(1).max(100) }))
      .mutation(({ ctx, input }) =>
        revokeInvitation(ctx, ctx.actor, {
          mode: ctx.config.workspaces.mode,
          invitationId: input.invitationId,
        })
      ),

    preview: publicProcedure
      .input(z.object({ token }))
      .query(({ ctx, input }) => previewInvitation(ctx, input)),

    accept: protectedProcedure
      .input(z.object({ token }))
      .mutation(({ ctx, input }) =>
        acceptInvitation(ctx, {
          mode: ctx.config.workspaces.mode,
          token: input.token,
          user: ctx.user,
        })
      ),
  }),
});
