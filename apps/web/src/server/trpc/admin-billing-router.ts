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

import { adminProcedure, router } from "./init";

const workspaceId = z
  .string()
  .min(1)
  .max(200)
  .describe("The workspace to inspect or change.");

/**
 * Platform admin (`adminProcedure`, mounted at `admin.billing`): a workspace's plan, add-ons, entitlement overrides and usage (any
 * workspace, not only the admin's own). Every change is audited (`billing.*`).
 */
export const adminBillingRouter = router({
  get: adminProcedure
    .input(z.object({ workspaceId }))
    .query(({ ctx, input }) =>
      getWorkspaceBilling({ ...ctx, settings: ctx.config.billing }, input)
    ),

  usage: adminProcedure
    .input(z.object({ workspaceId }))
    .query(({ ctx, input }) =>
      getUsageSummary(
        { ...ctx, settings: ctx.config.billing },
        input.workspaceId
      )
    ),

  assignPlan: adminProcedure
    .input(assignPlanInputSchema)
    .mutation(({ ctx, input }) => assignPlan(ctx, ctx.admin, input)),

  setAddons: adminProcedure
    .input(setAddonsInputSchema)
    .mutation(({ ctx, input }) => setAddons(ctx, ctx.admin, input)),

  setOverride: adminProcedure
    .input(setOverrideInputSchema)
    .mutation(({ ctx, input }) => setOverride(ctx, ctx.admin, input)),
});
