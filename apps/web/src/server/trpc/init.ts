import {
  type Actor,
  type Clock,
  type Database,
  DomainError,
  type EmailService,
  type ErrorReporter,
  enforceRateLimit,
  type FeatureFlagStore,
  type FeatureFlags,
  type Ids,
  type JobQueue,
  type Logger,
  mutationPolicy,
  type ProductAnalytics,
  type R2Config,
  type RateLimiter,
  type RequestContext,
  resolveActor,
} from "@cloudflare-starter/features";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

import type { FeatureConfig, RequiredAppConfig } from "@/lib/config";

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
  /** Product analytics of this request; use cases track with `trackEvent`. */
  readonly analytics: ProductAnalytics;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    /**
     * Platform role. TODO(admin-portal): no user column holds it yet, so it is never set
     * outside tests and admin procedures answer NOT_FOUND (see trpc/admin.ts).
     */
    readonly role?: string | null;
  } | null;
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
