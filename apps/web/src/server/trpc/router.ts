import {
  createDownloadUrl,
  createPresignedUpload,
  listOwnedFiles,
  sendHello,
  uploadInputSchema,
} from "@cloudflare-starter/features";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { displayName } from "@/lib/user";

import { protectedProcedure, publicProcedure, router } from "./init";
import { requireFeature } from "./require-feature";

/**
 * Procedures are adapters: validate input, check auth, call one use case, return its
 * result. Business rules live in packages/features. Every procedure has an MCP tool
 * (server/mcp/tools.ts).
 */
export const appRouter = router({
  health: router({
    hello: protectedProcedure.query(({ ctx }) => ({
      message: "hello world",
      user: ctx.user.email,
      environment: ctx.config.APP_ENV,
    })),
  }),

  storage: router({
    listFiles: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).optional() }))
      .query(async ({ ctx, input }) => ({
        items: await listOwnedFiles(ctx, {
          ownerUserId: ctx.user.id,
          limit: input.limit,
        }),
      })),

    createUpload: protectedProcedure
      .input(uploadInputSchema)
      .mutation(({ ctx, input }) =>
        createPresignedUpload(
          { ...ctx, r2: ctx.r2.value },
          { ...input, ownerUserId: ctx.user.id }
        )
      ),

    getDownloadUrl: protectedProcedure
      .input(z.object({ fileId: z.uuid() }))
      .query(({ ctx, input }) =>
        createDownloadUrl(
          { ...ctx, r2: ctx.r2.value },
          { fileId: input.fileId, ownerUserId: ctx.user.id }
        )
      ),
  }),

  queue: router({
    enqueueHello: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.queue) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Queue is not configured",
          });
        }
        await sendHello(
          { queue: ctx.queue, clock: ctx.clock },
          { name: input.name, userId: ctx.user.id }
        );
        return { queued: true };
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
