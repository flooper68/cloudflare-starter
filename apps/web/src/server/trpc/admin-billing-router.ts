import {
  assignPlan,
  assignPlanInputSchema,
  getUsageSummary,
  getWorkspaceBilling,
  setAddons,
  setAddonsInputSchema,
  setOverride,
  setOverrideInputSchema,
} from "@cloudflare-starter/features";
import { z } from "zod";

import { localAdminProcedure } from "./admin";
import { router } from "./init";

/** TODO(admin-portal): the admin portal's `adminProcedure` replaces localAdminProcedure. */
const platformAdminProcedure = localAdminProcedure.use(({ ctx, next }) =>
  next({ ctx: { ...ctx, admin: { userId: ctx.user.id } } })
);

const workspaceId = z
  .string()
  .min(1)
  .max(200)
  .describe("The workspace to inspect or change.");

/**
 * Platform admin: a workspace's plan, add-ons, entitlement overrides and usage (any
 * workspace, not only the admin's own). Every change is audited (`billing.*`).
 */
export const adminBillingRouter = router({
  get: platformAdminProcedure
    .input(z.object({ workspaceId }))
    .query(({ ctx, input }) =>
      getWorkspaceBilling({ ...ctx, settings: ctx.config.billing }, input)
    ),

  usage: platformAdminProcedure
    .input(z.object({ workspaceId }))
    .query(({ ctx, input }) =>
      getUsageSummary(
        { ...ctx, settings: ctx.config.billing },
        input.workspaceId
      )
    ),

  assignPlan: platformAdminProcedure
    .input(assignPlanInputSchema)
    .mutation(({ ctx, input }) => assignPlan(ctx, ctx.admin, input)),

  setAddons: platformAdminProcedure
    .input(setAddonsInputSchema)
    .mutation(({ ctx, input }) => setAddons(ctx, ctx.admin, input)),

  setOverride: platformAdminProcedure
    .input(setOverrideInputSchema)
    .mutation(({ ctx, input }) => setOverride(ctx, ctx.admin, input)),
});
