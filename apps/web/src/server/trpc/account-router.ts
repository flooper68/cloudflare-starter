import {
  accountSettingsSchema,
  getAccountSettings,
  listAccountSessions,
  removeAccountAvatar,
  revokeAccountSession,
  updateAccountSettings,
} from "@cloudflare-starter/features";
import { z } from "zod";
import { protectedProcedure, router } from "./init";
import { securityRouter } from "./security-router";

/** Personal settings and sessions are independent of workspace membership. */
export const accountRouter = router({
  security: securityRouter,
  settings: router({
    get: protectedProcedure.query(({ ctx }) =>
      getAccountSettings(ctx, { userId: ctx.user.id })
    ),
    update: protectedProcedure
      .input(accountSettingsSchema)
      .mutation(({ ctx, input }) =>
        updateAccountSettings(ctx, { userId: ctx.user.id, settings: input })
      ),
  }),
  sessions: router({
    list: protectedProcedure.query(async ({ ctx }) => ({
      items: await listAccountSessions(ctx, {
        userId: ctx.user.id,
        currentSessionId: ctx.session?.id,
      }),
    })),
    revoke: protectedProcedure
      .input(z.object({ sessionId: z.string().min(1).max(100) }))
      .mutation(({ ctx, input }) =>
        revokeAccountSession(
          { ...ctx, gateway: ctx.accountAuth },
          { userId: ctx.user.id, sessionId: input.sessionId }
        )
      ),
  }),
  removeAvatar: protectedProcedure.mutation(({ ctx }) =>
    removeAccountAvatar(ctx, { userId: ctx.user.id })
  ),
});
