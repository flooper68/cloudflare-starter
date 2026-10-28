import { schema } from "@cloudflare-starter/features";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { buildEmailFeature, buildRequiredConfig } from "@/lib/env";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";

export const AUTH_BASE_PATH = "/api/auth";

export function isGoogleEnabled(env: AppEnv): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function createAuthOptions(env: AppEnv) {
  const config = buildRequiredConfig(env);
  const email = buildEmailFeature(env);

  return {
    appName: "Cloudflare Starter",
    baseURL: config.APP_URL,
    basePath: AUTH_BASE_PATH,
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.APP_URL],
    // D1 has no interactive transactions.
    database: drizzleAdapter(getDb(env), {
      provider: "sqlite",
      schema,
      transaction: false,
    }),
    emailAndPassword: {
      enabled: true,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        if (!email.enabled || !email.value) {
          // Local dev without Mailjet: the link is printed to the dev server log.
          console.log(`[auth] Password reset link for ${user.email}: ${url}`);
          return;
        }

        await email.value.send({
          to: { email: user.email, name: user.name },
          subject: "Reset your password",
          text: `Open this link to choose a new password: ${url}`,
          html: `<p>Open <a href="${url}">this link</a> to choose a new password.</p>`,
        });
      },
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: "select_account" as const,
            },
          }
        : {},
    session: {
      // Short cookie cache keeps get-session cheap without long-lived stale data.
      cookieCache: { enabled: true, maxAge: 60 },
    },
    advanced: {
      // Behind Cloudflare the client IP is CF-Connecting-IP.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/*": { window: 60, max: 10 },
        "/sign-up/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}

function createAuth(env: AppEnv) {
  return betterAuth(createAuthOptions(env));
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"];

/** Per-isolate cache, like the database client. */
let cache: { readonly env: AppEnv; readonly auth: Auth } | undefined;

export function getAuth(env: AppEnv): Auth {
  if (!cache || cache.env !== env) {
    cache = { env, auth: createAuth(env) };
  }
  return cache.auth;
}
