import { TRPCError } from "@trpc/server";

import { publicProcedure } from "./init";

/** The platform role that may use admin procedures. */
export const PLATFORM_ADMIN_ROLE = "admin";

/**
 * TODO(admin-portal): a minimal stand-in for the admin portal's `adminProcedure`. Replace
 * every use with it when that PR merges, and delete this file.
 *
 * Requires a signed-in user whose platform `role` is "admin". No user column holds a role
 * yet, so outside tests nobody passes and the admin procedures stay disabled. Anyone else,
 * signed in or not, gets NOT_FOUND, so the procedures do not reveal that they exist.
 */
export const localAdminProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== PLATFORM_ADMIN_ROLE) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
