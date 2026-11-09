import {
  analyticsEvents,
  clientBatchSchema,
  createDownloadUrl,
  createPresignedUpload,
  evaluateClientFlags,
  FEATURE_TRIAL_CLIENT_EVENTS,
  listWorkspaceFiles,
  recordFeatureTried,
  resolveEntitlements,
  sendHello,
  testEmail,
  trackClientEvents,
  trashFile,
  uploadInputSchema,
} from "@cloudflare-starter/features";
import { z } from "zod";

import { displayName } from "@/lib/user";
import { accountRouter } from "./account-router";
import { adminRouter } from "./admin-router";
import { containerRunsRouter } from "./container-runs-router";
import {
  protectedProcedure,
  publicProcedure,
  router,
  workspaceProcedure,
} from "./init";
import { notesRouter } from "./notes-router";
import { notificationsRouter } from "./notifications-router";
import { privacyRouter } from "./privacy-router";
import { requireFeature } from "./require-feature";
import { trashRouter } from "./trash-router";
import { workspaceRouter } from "./workspace-router";

/**
 * Procedures are adapters: validate input, check auth, call one use case, return its
 * result. Business rules live in packages/features. Every procedure has an MCP tool
 * (server/mcp/tools.ts). Data belongs to a workspace: data procedures are
 * `workspaceProcedure`s and pass `ctx.actor` to the use case.
 */
export const appRouter = router({
  health: router({
    hello: protectedProcedure.query(({ ctx }) => ({
      message: "hello world",
      user: ctx.user.email,
      environment: ctx.config.APP_ENV,
    })),
  }),

  workspace: workspaceRouter,
  account: accountRouter,

  notifications: notificationsRouter,
  privacy: privacyRouter,
  admin: adminRouter,

  storage: router({
    listFiles: workspaceProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }))
      .query(async ({ ctx, input }) => ({
        items: await listWorkspaceFiles(ctx, ctx.actor, { limit: input.limit }),
      })),

    createUpload: workspaceProcedure
      .input(uploadInputSchema)
      .mutation(({ ctx, input }) =>
        createPresignedUpload({ ...ctx, r2: ctx.r2.value }, ctx.actor, {
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        })
      ),

    getDownloadUrl: workspaceProcedure
      .input(z.object({ fileId: z.uuid() }))
      .query(({ ctx, input }) =>
        createDownloadUrl({ ...ctx, r2: ctx.r2.value }, ctx.actor, {
          fileId: input.fileId,
        })
      ),

    /** Moves a file to the workspace's trash; `trash.restore` brings it back. */
    deleteFile: workspaceProcedure
      .input(z.object({ fileId: z.uuid() }))
      .mutation(({ ctx, input }) =>
        trashFile(ctx, ctx.actor, { fileId: input.fileId })
      ),
  }),

  trash: trashRouter,

  // The placeholder Notes app (docs/guides/how-to-add-a-feature.md).
  notes: notesRouter,

  // The container workflow demo (Developer demos).
  containerRuns: containerRunsRouter,

  queue: router({
    enqueueHello: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        const { id } = await sendHello(
          ctx,
          { name: input.name },
          { context: ctx.requestContext }
        );
        return { queued: true, jobId: id };
      }),
  }),

  email: router({
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      const email = requireFeature(ctx.email);
      await email.send(
        testEmail({
          to: { email: ctx.user.email, name: displayName(ctx.user) },
          environment: ctx.config.APP_ENV,
        })
      );
      return { sent: true };
    }),
  }),

  public: router({
    hello: publicProcedure.query(() => ({ message: "hello world" })),
  }),

  flags: router({
    /**
     * The caller's values of the `client: true` flags in a workspace they belong to: a
     * workspace rollout gives every member the same value.
     */
    client: workspaceProcedure.query(async ({ ctx }) => ({
      flags: await evaluateClientFlags(ctx, {
        userId: ctx.actor.userId,
        workspaceId: ctx.actor.workspaceId,
        // Plan-targeted rules see the workspace's plan in effect (billing).
        plan: (
          await resolveEntitlements(
            { ...ctx, settings: ctx.config.billing },
            ctx.actor.workspaceId
          )
        ).planId,
        environment: ctx.config.APP_ENV,
      }),
    })),
  }),

  analytics: router({
    /**
     * Client telemetry: a batch of up to 20 `client: true` events of the analytics
     * catalog, attributed to the caller and their workspace. Write-only; limited by
     * `analytics.client`, not the mutation budget.
     */
    track: workspaceProcedure
      .input(clientBatchSchema)
      .mutation(async ({ ctx, input }) => {
        const result = trackClientEvents(ctx, ctx.requestContext, {
          catalog: analyticsEvents,
          batch: { events: input.events },
        });
        // A client event that means a feature was used (the command palette opened).
        for (const feature of new Set(
          input.events.flatMap(
            (event) => FEATURE_TRIAL_CLIENT_EVENTS[event.event] ?? []
          )
        )) {
          await recordFeatureTried(
            ctx,
            { ...ctx.requestContext, userId: ctx.user.id },
            feature
          );
        }
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
