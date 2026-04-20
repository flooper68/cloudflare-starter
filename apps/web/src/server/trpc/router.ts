import {
  createFileRecord,
  enqueueAppMessage,
  findOwnedFile,
  presignDownload,
  presignUpload,
  uploadInputSchema,
} from "@cloudflare-starter/features";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getFeatureError } from "@/lib/config";
import { displayName } from "@/lib/user";

import { protectedProcedure, publicProcedure, router } from "./init";

export const appRouter = router({
  health: router({
    hello: protectedProcedure.query(({ ctx }) => ({
      message: "hello world",
      user: ctx.appUser?.email ?? "unknown",
      environment: ctx.config.APP_ENV,
    })),
  }),

  storage: router({
    createUpload: protectedProcedure
      .input(uploadInputSchema)
      .mutation(async ({ ctx, input }) => {
        if (!ctx.r2.enabled || !ctx.r2.value) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: getFeatureError(ctx.r2.reason),
          });
        }

        const file = await createFileRecord(ctx.db, {
          ...input,
          ownerUserId: ctx.appUser.id,
        });
        const uploadUrl = await presignUpload(ctx.r2.value, file.r2Key, input);

        return {
          fileId: file.fileId,
          r2Key: file.r2Key,
          uploadUrl,
        };
      }),

    getDownloadUrl: protectedProcedure
      .input(z.object({ fileId: z.uuid() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.r2.enabled || !ctx.r2.value) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: getFeatureError(ctx.r2.reason),
          });
        }

        const file = await findOwnedFile(ctx.db, {
          fileId: input.fileId,
          ownerUserId: ctx.appUser.id,
        });

        if (!file) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "File not found",
          });
        }

        return {
          url: await presignDownload(ctx.r2.value, file.r2Key),
        };
      }),
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

        await enqueueAppMessage(ctx.queue, {
          type: "hello",
          name: input.name,
          userId: ctx.appUser.id,
          queuedAt: new Date().toISOString(),
        });

        return {
          queued: true,
        };
      }),
  }),

  email: router({
    sendTest: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.email.enabled || !ctx.email.value) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: getFeatureError(ctx.email.reason),
        });
      }

      const email = ctx.clerkUser.primaryEmailAddress?.emailAddress;
      if (!email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Signed-in Clerk user is missing a primary email address",
        });
      }

      await ctx.email.value.sendTestEmail({
        to: {
          email,
          name: displayName({
            firstName: ctx.clerkUser.firstName,
            lastName: ctx.clerkUser.lastName,
            email,
          }),
        },
        environment: ctx.config.APP_ENV,
      });

      return { sent: true };
    }),
  }),

  public: router({
    hello: publicProcedure.query(() => ({
      message: "hello world",
    })),
  }),
});

export type AppRouter = typeof appRouter;
