import {
  adminUserQuerySchema,
  adminWorkspaceQuerySchema,
  assignWorkspaceOwner,
  auditQuerySchema,
  banUser,
  buildErasureHandlers,
  deleteWorkspace,
  deleteWorkspaceFiles,
  deploymentSettings,
  eraseUserData,
  flagRulesSchema,
  flagUpdateSchema,
  getAdminOverview,
  getAnalyticsReport,
  getDemoStats,
  getUserDetail,
  getWorkspaceDetail,
  listAdminDataRequests,
  listAllWorkspaces,
  listAuditEvents,
  listFlags,
  listUsers,
  PLATFORM_ROLES,
  REPORT_PERIODS,
  requestDataExport,
  requestStorageReconciliation,
  resetSecondFactor,
  revokeUserSessions,
  STORAGE_GRACE_MS,
  sendAdminTestEmail,
  sendPasswordReset,
  setFlagRules,
  setUserRole,
  startImpersonation,
  stopImpersonation,
  unbanUser,
  updateFlag,
} from "@cloudflare-starter/features";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authMethodsOf } from "@/server/auth";
import { adminBillingRouter } from "./admin-billing-router";
import {
  adminDestructiveProcedure,
  adminProcedure,
  impersonatorProcedure,
  router,
} from "./init";
import { requireFeature } from "./require-feature";

const userId = z
  .string()
  .min(1)
  .max(320)
  .describe("The user's id (see admin_list_users).");
const workspaceId = z
  .string()
  .min(1)
  .max(100)
  .describe("The workspace's id (see admin_list_workspaces).");

/** Where the emailed reset link lands: the app's own reset page. */
const RESET_PASSWORD_PAGE = "/reset-password";

/**
 * The admin portal's API: every procedure is an `adminProcedure` (role admin and
 * ADMIN_PORTAL=on, else NOT_FOUND) and destructive ones an `adminDestructiveProcedure`
 * (recent sign-in, else REAUTH_REQUIRED). Use cases live in packages/features/src/admin.
 * test/architecture/admin-procedures.test.ts checks every procedure here is gated.
 */
export const adminRouter = router({
  privacy: router({
    list: adminProcedure.query(({ ctx }) =>
      listAdminDataRequests(ctx, ctx.admin)
    ),
    requestExport: adminProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) => requestDataExport(ctx, input.userId)),
    eraseUser: adminDestructiveProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) => {
        if (!ctx.browser)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Account erasure requires a signed-in browser",
          });
        return eraseUserData(
          { ...ctx, ...buildErasureHandlers(ctx), gateway: ctx.adminAuth },
          ctx.admin,
          input
        );
      }),
  }),
  storage: router({
    status: adminProcedure.query(({ ctx }) => ({
      mode: ctx.config.STORAGE_RECONCILE,
      graceHours: STORAGE_GRACE_MS / 3600000,
    })),
    reconcile: adminProcedure.mutation(({ ctx }) =>
      requestStorageReconciliation(
        { ...ctx, storageReconcile: ctx.config.STORAGE_RECONCILE },
        ctx.admin
      )
    ),
    deleteOrphans: adminDestructiveProcedure.mutation(({ ctx }) =>
      requestStorageReconciliation(
        { ...ctx, storageReconcile: ctx.config.STORAGE_RECONCILE },
        ctx.admin,
        { deleteOrphans: true }
      )
    ),
  }),
  overview: router({
    get: adminProcedure.query(async ({ ctx }) => ({
      ...(await getAdminOverview(
        { ...ctx, billing: ctx.config.billing },
        ctx.admin
      )),
      // DEMO_MODE=on: active demo accounts, deletions due today, erased in 7 days.
      demo:
        ctx.demo.mode === "on"
          ? await getDemoStats(ctx, ctx.admin, ctx.demo.policy)
          : null,
    })),
  }),

  analytics: router({
    // The product funnel and its breakdowns, read from Analytics Engine with the
    // analytics read token (status not_configured without it); nothing is stored.
    get: adminProcedure
      .input(
        z.object({
          days: z
            .union([z.literal(1), z.literal(7), z.literal(30)])
            .default(7)
            .describe(
              `The period in days: ${REPORT_PERIODS.join(", ")}. Default 7.`
            ),
        })
      )
      .query(({ ctx, input }) =>
        getAnalyticsReport(ctx, ctx.analyticsRead(), { days: input.days })
      ),
  }),

  health: router({
    // A live readiness check with each failure's detail; nothing is stored.
    get: adminProcedure.query(({ ctx }) => ctx.readiness()),
  }),

  email: router({
    // The real sending path to any address (the QA suite's weekly delivery check).
    sendTest: adminProcedure
      .input(z.object({ to: z.email().max(254) }))
      .mutation(({ ctx, input }) =>
        sendAdminTestEmail(
          { ...ctx, email: requireFeature(ctx.email) },
          ctx.admin,
          { to: input.to, environment: ctx.config.APP_ENV }
        )
      ),
  }),

  settings: router({
    get: adminProcedure.query(({ ctx }) =>
      deploymentSettings({
        environment: ctx.config.APP_ENV,
        workspaceMode: ctx.config.workspaces.mode,
        signUp: ctx.config.workspaces.signUp,
        signUpDomains: ctx.config.workspaces.signUpDomains,
        bootstrapAdminEmail: ctx.config.workspaces.bootstrapAdminEmail,
        emailEnabled: ctx.email.enabled,
        adminPortal: ctx.config.ADMIN_PORTAL,
        demo:
          ctx.demo.mode === "on"
            ? {
                mode: "on",
                retentionDays: ctx.demo.policy.retentionDays,
                sampleData: ctx.demo.sampleData,
                protectedEmails: ctx.demo.policy.protectedEmails,
                qaEmailDomain: ctx.demo.policy.qaEmailDomain,
              }
            : { mode: "off" },
        methods: authMethodsOf(ctx.config),
      })
    ),
  }),

  users: router({
    list: adminProcedure
      .input(adminUserQuerySchema)
      .query(({ ctx, input }) => listUsers(ctx, ctx.admin, input)),

    get: adminProcedure
      .input(z.object({ userId }))
      .query(({ ctx, input }) => getUserDetail(ctx, ctx.admin, input)),

    ban: adminDestructiveProcedure
      .input(
        z.object({
          userId,
          reason: z
            .string()
            .max(200)
            .optional()
            .describe("Why, shown to other admins in the audit log."),
          expiresAt: z.iso
            .datetime()
            .optional()
            .describe(
              "When the suspension ends (ISO 8601); omit for permanent."
            ),
        })
      )
      .mutation(({ ctx, input }) =>
        banUser({ ...ctx, gateway: ctx.adminAuth }, ctx.admin, {
          userId: input.userId,
          reason: input.reason ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        })
      ),

    unban: adminProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) =>
        unbanUser({ ...ctx, gateway: ctx.adminAuth }, ctx.admin, input)
      ),

    resetSecondFactor: adminDestructiveProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) => {
        if (!ctx.browser)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Factor recovery requires the browser.",
          });
        return resetSecondFactor(
          { ...ctx, gateway: ctx.adminAuth },
          ctx.admin,
          input
        );
      }),
    revokeSessions: adminDestructiveProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) =>
        revokeUserSessions({ ...ctx, gateway: ctx.adminAuth }, ctx.admin, input)
      ),

    setRole: adminDestructiveProcedure
      .input(z.object({ userId, role: z.enum(PLATFORM_ROLES) }))
      .mutation(({ ctx, input }) =>
        setUserRole({ ...ctx, gateway: ctx.adminAuth }, ctx.admin, input)
      ),

    remove: adminDestructiveProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) => {
        if (!ctx.browser)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Account erasure requires a signed-in browser",
          });
        return eraseUserData(
          { ...ctx, ...buildErasureHandlers(ctx), gateway: ctx.adminAuth },
          ctx.admin,
          input
        );
      }),

    sendPasswordReset: adminProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) =>
        sendPasswordReset({ ...ctx, gateway: ctx.adminAuth }, ctx.admin, {
          userId: input.userId,
          redirectTo: RESET_PASSWORD_PAGE,
        })
      ),
  }),

  impersonation: router({
    start: adminProcedure
      .input(z.object({ userId }))
      .mutation(({ ctx, input }) => {
        if (!ctx.browser) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Impersonation needs a browser session",
          });
        }
        return startImpersonation(
          { ...ctx, gateway: ctx.adminAuth },
          ctx.admin,
          input
        );
      }),

    stop: impersonatorProcedure.mutation(({ ctx }) =>
      stopImpersonation(
        { ...ctx, gateway: ctx.adminAuth },
        { userId: ctx.user.id, impersonatedBy: ctx.impersonatedBy }
      )
    ),
  }),

  workspaces: router({
    list: adminProcedure
      .input(adminWorkspaceQuerySchema)
      .query(({ ctx, input }) =>
        listAllWorkspaces(ctx, ctx.admin, {
          ...input,
          mode: ctx.config.workspaces.mode,
        })
      ),

    get: adminProcedure
      .input(z.object({ workspaceId }))
      .query(({ ctx, input }) =>
        getWorkspaceDetail(ctx, ctx.admin, {
          workspaceId: input.workspaceId,
          mode: ctx.config.workspaces.mode,
        })
      ),

    assignOwner: adminDestructiveProcedure
      .input(z.object({ workspaceId, userId }))
      .mutation(({ ctx, input }) =>
        assignWorkspaceOwner(ctx, ctx.admin, {
          ...input,
          mode: ctx.config.workspaces.mode,
        })
      ),

    delete: adminDestructiveProcedure
      .input(z.object({ workspaceId }))
      .mutation(({ ctx, input }) =>
        deleteWorkspace(
          {
            ...ctx,
            purgeWorkspaceFiles: async (workspaceIds) => {
              await deleteWorkspaceFiles(ctx, { workspaceIds });
            },
          },
          ctx.admin,
          {
            workspaceId: input.workspaceId,
            mode: ctx.config.workspaces.mode,
          }
        )
      ),
  }),

  // Plans, add-ons, overrides and usage of any workspace (docs/guides/how-to-configure-plans-and-billing.md).
  billing: adminBillingRouter,

  // Feature flags (packages/features/src/feature-flags, docs/guides/how-to-use-feature-flags.md).
  flags: router({
    list: adminProcedure.query(async ({ ctx }) => ({
      flags: await listFlags(ctx),
    })),

    update: adminProcedure
      .input(flagUpdateSchema)
      .mutation(({ ctx, input }) =>
        updateFlag(ctx, { ...input, actorUserId: ctx.admin.userId })
      ),

    setRules: adminProcedure
      .input(flagRulesSchema)
      .mutation(({ ctx, input }) =>
        setFlagRules(ctx, { ...input, actorUserId: ctx.admin.userId })
      ),
  }),

  audit: router({
    list: adminProcedure
      .input(auditQuerySchema)
      .query(({ ctx, input }) => listAuditEvents(ctx, input)),
  }),
});
