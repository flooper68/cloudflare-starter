import {
  type Actor,
  type AdminActor,
  type AdminAuthGateway,
  type Clock,
  type Database,
  DomainError,
  type EmailService,
  type ErrorReporter,
  enforceRateLimit,
  type FeatureFlagStore,
  type FeatureFlags,
  findAdminAccess,
  type Ids,
  isRecentSignIn,
  type JobQueue,
  type Logger,
  mutationPolicy,
  type R2Config,
  type RateLimiter,
  ReauthRequiredError,
  type RequestContext,
  resolveActor,
} from "@cloudflare-starter/features";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import type { FeatureConfig, RequiredAppConfig } from "@/lib/config";
import type { BrowserExchange } from "@/server/admin-auth-gateway";

import { toTrpcError } from "./domain-errors";

export interface Context {
  readonly db: Database;
  readonly clock: Clock;
  readonly ids: Ids;
  readonly config: RequiredAppConfig;
  readonly email: FeatureConfig<EmailService>;
  readonly r2: FeatureConfig<R2Config>;
  readonly jobQueue: JobQueue;
  /** The request (or MCP call) this procedure runs for; its trace id is the error reference. */
  readonly requestContext: RequestContext;
  /** Logger bound to the request context. */
  readonly logger: Logger;
  readonly errors: ErrorReporter;
  /** The FILES binding, for use cases that delete objects. */
  readonly bucket: R2Bucket;
  /** Feature-flag provider: procedures pass it to `evaluateFlag` / use cases, never call it. */
  readonly flags: FeatureFlags;
  /** The provider's store (FEATURE_FLAGS=d1), null otherwise. */
  readonly flagStore: FeatureFlagStore | null;
  /** Edge rate limits; every mutation counts against its policy (limitMutations). */
  readonly rateLimiter: RateLimiter;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  } | null;
  /** The cookie session of a web request; null for MCP calls and anonymous requests. */
  readonly session: SessionInfo | null;
  /** The web request's headers in and response headers out; null for MCP calls. */
  readonly browser: BrowserExchange | null;
  /** The admin portal's way into Better Auth (server/admin-auth-gateway.ts). */
  readonly adminAuth: AdminAuthGateway;
}

/** What procedures read from the Better Auth session. */
export interface SessionInfo {
  /** When this session was created: the sign-in time, for recent-sign-in checks. */
  readonly createdAt: Date;
  /** The admin impersonating the user in this session, if it is an impersonation. */
  readonly impersonatedBy: string | null;
}

/**
 * Procedure metadata. `scope: "workspace"` marks a procedure that acts inside one
 * workspace (set by `workspaceProcedure`); test/architecture/workspace-scope.test.ts
 * requires it on every procedure of the workspace-scoped routers.
 */
export interface Meta {
  readonly scope?: "workspace";
}

const t = initTRPC
  .context<Context>()
  .meta<Meta>()
  .create({
    /**
     * Internal errors carry `data.reference` (the trace id) so users can quote it, and a
     * generic message: the cause (a driver error, a stack frame) goes to the error report,
     * never to the client.
     */
    errorFormatter({ shape, error, ctx }) {
      const internal = error.code === "INTERNAL_SERVER_ERROR";
      // tRPC adds `stack` whenever NODE_ENV is not "production", which includes built
      // Workers; stacks belong in error reports, never in responses.
      const { stack: _stack, ...data } = shape.data;
      return {
        ...shape,
        message: internal ? "Internal error" : shape.message,
        data: {
          ...data,
          reference: internal && ctx ? ctx.requestContext.traceId : undefined,
          // A use case's stable error code (NOT_A_WORKSPACE_MEMBER), for clients to branch on.
          appCode:
            error.cause instanceof DomainError ? error.cause.code : undefined,
        },
      };
    },
  });

/** Reports unexpected failures (anything that stays INTERNAL_SERVER_ERROR) once, with context. */
const reportInternalErrors = t.middleware(async ({ ctx, next, path, type }) => {
  const result = await next();
  if (!result.ok && result.error.code === "INTERNAL_SERVER_ERROR") {
    ctx.errors.capture(result.error.cause ?? result.error, ctx.requestContext, {
      "rpc.system": "trpc",
      "rpc.method": path,
      "app.trpc.type": type,
    });
  }
  return result;
});

/** Turns DomainErrors thrown by use cases into tRPC errors (see domain-errors.ts). */
const mapDomainErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) throw toTrpcError(result.error);
  return result;
});

/**
 * Every mutation counts against its policy (PROCEDURE_POLICIES, default mutation.user),
 * by user, or by IP when anonymous. Refusals become TOO_MANY_REQUESTS.
 */
const limitMutations = t.middleware(async ({ ctx, type, path, next }) => {
  const policy = type === "mutation" ? mutationPolicy(path) : null;
  if (policy) {
    await enforceRateLimit(ctx, {
      policy,
      subject: { userId: ctx.user?.id ?? null, ip: ctx.requestContext.ip },
    });
  }
  return next();
});

export const router = t.router;
export const publicProcedure = t.procedure
  .use(reportInternalErrors)
  .use(mapDomainErrors)
  .use(limitMutations);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to access this resource",
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

/**
 * The input every workspace procedure accepts: the workspace to act in. Without it the
 * user's default applies (their only workspace in personal and single mode, the one they
 * switched to last in multi mode), the same for the web app and MCP clients.
 */
export const workspaceInput = z.object({
  workspaceId: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe(
      "The workspace to act in (see list_workspaces). Omit to use the user's current workspace."
    ),
});

/**
 * A protected procedure inside one workspace: resolves `ctx.actor` (the user, the
 * workspace and their role there) before the procedure runs. A workspace the user is not
 * a member of is NOT_FOUND. Use cases take the actor and check `can()`.
 */
export const workspaceProcedure = protectedProcedure
  .meta({ scope: "workspace" })
  .input(workspaceInput)
  .use(async ({ ctx, input, next }) => {
    const actor: Actor = await resolveActor(ctx, {
      userId: ctx.user.id,
      mode: ctx.config.workspaces.mode,
      workspaceId: input.workspaceId,
    });
    // Logs and error reports of this procedure name the workspace it acted in.
    const requestContext = {
      ...ctx.requestContext,
      workspaceId: actor.workspaceId,
    };
    return next({
      ctx: {
        ...ctx,
        actor,
        requestContext,
        logger: ctx.logger.withContext(requestContext),
      },
    });
  });

/** The answer for anyone who is not an admin, or when the portal is off: nothing here. */
function notFound(): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message: "Not found" });
}

/**
 * The gate of every `admin.*` procedure: ADMIN_PORTAL=on and the user is a platform admin
 * (role admin, not suspended), read from D1 on every call so a demotion or suspension takes
 * effect at once. Anything else, anonymous included, is NOT_FOUND: the portal does not
 * reveal that it exists. Exported as the marker test/architecture/admin-procedures.test.ts
 * looks for.
 */
export const requireAdmin = t.middleware(async ({ ctx, next }) => {
  if (ctx.config.ADMIN_PORTAL !== "on" || !ctx.user) throw notFound();
  const access = await findAdminAccess(ctx, { userId: ctx.user.id });
  if (!access.isAdmin) throw notFound();
  const admin: AdminActor = { userId: ctx.user.id };
  return next({
    ctx: { ...ctx, user: ctx.user, admin, lastSignInAt: access.lastSignInAt },
  });
});

/** Procedures of the admin portal (`admin.*`): see requireAdmin. */
export const adminProcedure = publicProcedure.use(requireAdmin);

/**
 * Hook for a second factor on destructive admin actions (a later change adds 2FA). Today
 * it accepts every call.
 */
export function requireAdminSecondFactor(_ctx: {
  readonly admin: AdminActor;
}): void {}

/**
 * Admin procedures that remove access or data (suspend, delete, sign out, change roles,
 * delete or re-own a workspace) also need a sign-in from the last 15 minutes, else
 * FORBIDDEN with `appCode` REAUTH_REQUIRED. In the browser that is this session's sign-in;
 * over MCP (no browser session) the admin's newest own sign-in (owner decision).
 */
export const adminDestructiveProcedure = adminProcedure.use(({ ctx, next }) => {
  const signedInAt = ctx.session ? ctx.session.createdAt : ctx.lastSignInAt;
  if (!isRecentSignIn(signedInAt, ctx.clock.now())) {
    // Thrown as the domain error so the formatter adds its code (data.appCode).
    throw new ReauthRequiredError();
  }
  requireAdminSecondFactor(ctx);
  return next();
});

/**
 * The one admin procedure an impersonated session calls: stopping the impersonation. The
 * session must be an impersonation by an active admin, with the portal on; anything else
 * is NOT_FOUND, like every other `admin.*` procedure. Exported as a marker for the
 * architecture test.
 */
export const requireImpersonator = t.middleware(async ({ ctx, next }) => {
  const impersonatedBy = ctx.session?.impersonatedBy;
  if (ctx.config.ADMIN_PORTAL !== "on" || !ctx.user || !impersonatedBy) {
    throw notFound();
  }
  const access = await findAdminAccess(ctx, { userId: impersonatedBy });
  if (!access.isAdmin) throw notFound();
  return next({ ctx: { ...ctx, user: ctx.user, impersonatedBy } });
});

/** See requireImpersonator. */
export const impersonatorProcedure = publicProcedure.use(requireImpersonator);
