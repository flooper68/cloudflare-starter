import type {
  Clock,
  Database,
  EmailService,
  Ids,
  QueueMessage,
  R2Config,
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
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string;
  } | null;
}

const t = initTRPC.context<Context>().create();

/** Turns DomainErrors thrown by use cases into tRPC errors (see domain-errors.ts). */
const mapDomainErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) throw toTrpcError(result.error);
  return result;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(mapDomainErrors);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to access this resource",
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});
