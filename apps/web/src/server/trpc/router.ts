import {
  createDownloadUrl,
  createPresignedUpload,
  listWorkspaceFiles,
  sendHello,
  uploadInputSchema,
} from "@cloudflare-starter/features";
import { z } from "zod";

import { displayName } from "@/lib/user";

import {
  protectedProcedure,
  publicProcedure,
  router,
  workspaceProcedure,
} from "./init";
import { requireFeature } from "./require-feature";
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
  }),

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
      await email.sendTestEmail({
        to: { email: ctx.user.email, name: displayName(ctx.user) },
        environment: ctx.config.APP_ENV,
      });
      return { sent: true };
    }),
  }),

  public: router({
    hello: publicProcedure.query(() => ({ message: "hello world" })),
  }),
});

export type AppRouter = typeof appRouter;
