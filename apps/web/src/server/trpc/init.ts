import type {
  AppQueueMessage,
  Database,
  EmailService,
  R2Config,
} from "@cloudflare-starter/features";
import { initTRPC, TRPCError } from "@trpc/server";
import type { FeatureConfig, RequiredAppConfig } from "@/lib/config";
import type { ClerkUserSnapshot } from "@/server/auth/ensure-user";

export interface Context {
  readonly db: Database;
  readonly config: RequiredAppConfig;
  readonly email: FeatureConfig<EmailService>;
  readonly r2: FeatureConfig<R2Config>;
  readonly queue: Queue<AppQueueMessage> | undefined;
  readonly clerkUser: ClerkUserSnapshot | null;
  readonly appUser: {
    readonly id: string;
    readonly email: string;
    readonly name: string | null;
  } | null;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.clerkUser || !ctx.appUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sign in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      clerkUser: ctx.clerkUser,
      appUser: ctx.appUser,
    },
  });
});
