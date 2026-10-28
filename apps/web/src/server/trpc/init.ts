import type {
  Clock,
  Database,
  EmailService,
  ErrorReporter,
  Ids,
  Logger,
  QueueMessage,
  R2Config,
  RequestContext,
} from "@cloudflare-starter/features";
import { initTRPC, TRPCError } from "@trpc/server";

import type { FeatureConfig, RequiredAppConfig } from "@/lib/config";

import { toTrpcError } from "./domain-errors";

export interface Context {
  readonly db: Database;
  readonly clock: Clock;
  readonly ids: Ids;
  readonly config: RequiredAppConfig;
  readonly email: FeatureConfig<EmailService>;
  readonly r2: FeatureConfig<R2Config>;
  readonly queue: Queue<QueueMessage> | undefined;
  /** The request (or MCP call) this procedure runs for; its id is the error reference. */
  readonly requestContext: RequestContext;
  /** Logger bound to the request context. */
  readonly logger: Logger;
  readonly errors: ErrorReporter;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  } | null;
}

const t = initTRPC.context<Context>().create({
  /**
   * Internal errors carry `data.reference` (the request id) so users can quote it, and a
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
        reference: internal && ctx ? ctx.requestContext.requestId : undefined,
      },
    };
  },
});

/** Reports unexpected failures (anything that stays INTERNAL_SERVER_ERROR) once, with context. */
const reportInternalErrors = t.middleware(async ({ ctx, next, path, type }) => {
  const result = await next();
  if (!result.ok && result.error.code === "INTERNAL_SERVER_ERROR") {
    ctx.errors.capture(result.error.cause ?? result.error, ctx.requestContext, {
      procedure: path,
      type,
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

export const router = t.router;
export const publicProcedure = t.procedure
  .use(reportInternalErrors)
  .use(mapDomainErrors);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to access this resource",
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});
