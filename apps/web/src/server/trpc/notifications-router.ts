import {
  archiveInputSchema,
  archiveNotifications,
  countUnreadNotifications,
  getNotificationPreferences,
  listNotifications,
  listNotificationsInputSchema,
  markNotificationsRead,
  markReadInputSchema,
  notificationCatalog,
  preferencesUpdateSchema,
  updateNotificationPreferences,
} from "@cloudflare-starter/features";
import { protectedProcedure, router } from "./init";

/** APP_URL without a trailing slash: the render context of the notification definitions. */
function appUrlOf(config: { readonly APP_URL: string }): string {
  return config.APP_URL.replace(/\/+$/, "");
}

/**
 * The signed-in user's notifications: inbox, unread count, read and archive, and
 * preferences. User-level (`protectedProcedure`): a user's messages are theirs across
 * workspaces, and every use case filters by `ctx.user.id`, so another user's ids are
 * ignored.
 */
export const notificationsRouter = router({
  list: protectedProcedure
    .input(listNotificationsInputSchema)
    .query(({ ctx, input }) =>
      listNotifications(
        {
          db: ctx.db,
          catalog: notificationCatalog,
          appUrl: appUrlOf(ctx.config),
        },
        { ...input, userId: ctx.user.id }
      )
    ),

  unreadCount: protectedProcedure.query(({ ctx }) =>
    countUnreadNotifications(ctx, { userId: ctx.user.id })
  ),

  markRead: protectedProcedure
    .input(markReadInputSchema)
    .mutation(({ ctx, input }) =>
      markNotificationsRead(ctx, { ...input, userId: ctx.user.id })
    ),

  archive: protectedProcedure
    .input(archiveInputSchema)
    .mutation(({ ctx, input }) =>
      archiveNotifications(ctx, { ids: input.ids, userId: ctx.user.id })
    ),

  preferences: router({
    get: protectedProcedure.query(({ ctx }) =>
      getNotificationPreferences(
        {
          db: ctx.db,
          catalog: notificationCatalog,
          emailEnabled: ctx.emailOut.enabled,
        },
        { userId: ctx.user.id }
      )
    ),

    update: protectedProcedure
      .input(preferencesUpdateSchema)
      .mutation(({ ctx, input }) =>
        updateNotificationPreferences(
          { ...ctx, catalog: notificationCatalog },
          { ...input, userId: ctx.user.id }
        )
      ),
  }),
});
