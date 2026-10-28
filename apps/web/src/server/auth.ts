import { mcp } from "@better-auth/mcp";
import { schema } from "@cloudflare-starter/features";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { jwt } from "better-auth/plugins";

import type { AppConfig } from "@/lib/config";
import { buildEmailFeature, buildRequiredConfig } from "@/lib/env";
import { auditAuthEndpoint, auditDatabaseHooks } from "@/server/auth-audit";
import {
  deliverAuthLinkWithoutEmail,
  EMAIL_LINK_PATHS,
  emailNotConfiguredError,
  mayLogAuthLinks,
} from "@/server/auth-mail";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";

export const AUTH_BASE_PATH = "/api/auth";
export const MCP_PATH = "/mcp";
export const SIGN_IN_PAGE = "/sign-in";
export const CONSENT_PAGE = "/consent";

export interface AuthMethods {
  readonly emailPassword: boolean;
  readonly google: boolean;
  readonly requireEmailVerification: boolean;
}

/** Which sign-in methods this deployment offers (env flags; Google needs both keys). */
export function getAuthMethods(env: AppEnv): AuthMethods {
  const config = buildRequiredConfig(env);
  return authMethodsOf(config);
}

function authMethodsOf(
  config: Pick<
    AppConfig,
    | "AUTH_EMAIL_PASSWORD"
    | "AUTH_REQUIRE_EMAIL_VERIFICATION"
    | "GOOGLE_CLIENT_ID"
    | "GOOGLE_CLIENT_SECRET"
  >
): AuthMethods {
  return {
    emailPassword: config.AUTH_EMAIL_PASSWORD,
    google: Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
    requireEmailVerification:
      config.AUTH_EMAIL_PASSWORD && config.AUTH_REQUIRE_EMAIL_VERIFICATION,
  };
}

/** The canonical MCP resource; access tokens are audience-bound to it. */
export function mcpResource(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}${MCP_PATH}`;
}

export function createAuthOptions(env: AppEnv) {
  const config = buildRequiredConfig(env);
  const methods = authMethodsOf(config);
  const email = buildEmailFeature(env);

  if (!methods.emailPassword && !methods.google) {
    throw new Error(
      "No sign-in method is enabled: set AUTH_EMAIL_PASSWORD=true or both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
    );
  }
  if (methods.requireEmailVerification && !email.enabled) {
    throw new Error(
      "AUTH_REQUIRE_EMAIL_VERIFICATION needs email: the EMAIL binding and EMAIL_FROM"
    );
  }

  // Auth links carry tokens: they may be logged only when APP_ENV is explicitly "local"
  // (an unset APP_ENV does not count). See server/auth-mail.ts.
  const linkEnvironment = env.APP_ENV ?? "";
  const refuseEmailLinks = !email.enabled && !mayLogAuthLinks(linkEnvironment);

  /** Mail when configured; otherwise the link goes to the local dev log, or the request fails. */
  async function sendAuthMail(input: {
    readonly to: { readonly email: string; readonly name: string };
    readonly subject: string;
    readonly action: string;
    readonly url: string;
  }) {
    if (!email.enabled || !email.value) {
      deliverAuthLinkWithoutEmail(
        { logger: buildPlatform(env).logger, environment: linkEnvironment },
        { subject: input.subject, to: input.to.email, url: input.url }
      );
      return;
    }

    await email.value.send({
      to: input.to,
      subject: input.subject,
      text: `Open this link to ${input.action}: ${input.url}`,
      html: `<p>Open <a href="${input.url}">this link</a> to ${input.action}.</p>`,
    });
  }

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
      enabled: methods.emailPassword,
      requireEmailVerification: methods.requireEmailVerification,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        await sendAuthMail({
          to: user,
          subject: "Reset your password",
          action: "choose a new password",
          url,
        });
      },
    },
    emailVerification: {
      // Sent on sign-up whenever email can go out; required only with the flag.
      sendOnSignUp: methods.emailPassword && email.enabled,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        await sendAuthMail({
          to: user,
          subject: "Verify your email",
          action: "verify your email address",
          url,
        });
      },
    },
    socialProviders:
      methods.google && config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: config.GOOGLE_CLIENT_ID,
              clientSecret: config.GOOGLE_CLIENT_SECRET,
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
    // Counters in D1, so the limit holds across isolates.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/*": { window: 60, max: 10 },
        "/sign-up/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/oauth2/register": { window: 3600, max: 5 },
        "/oauth2/token": { window: 60, max: 10 },
        "/oauth2/authorize": { window: 60, max: 10 },
      },
    },
    plugins: [
      jwt(),
      // OAuth 2.1 authorization server for MCP clients such as Claude: they register
      // themselves (RFC 7591), the user signs in on SIGN_IN_PAGE and approves on
      // CONSENT_PAGE, and the token works only for MCP_PATH.
      mcp({
        resource: mcpResource(config.APP_URL),
        loginPage: SIGN_IN_PAGE,
        consentPage: CONSENT_PAGE,
        scopes: ["openid", "profile", "email", "offline_access"],
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
      }),
    ],
    telemetry: { enabled: false },
    // Audit log: sign-in and sign-up (server/auth-audit.ts).
    databaseHooks: auditDatabaseHooks(env),
    hooks: {
      // Audit log: failed sign-in and password reset requests (server/auth-audit.ts).
      after: createAuthMiddleware((ctx) => auditAuthEndpoint(env, ctx)),
      // Deployed without email, refuse link-sending endpoints up front, for every address:
      // failing only inside sendResetPassword would answer differently for registered
      // emails (account enumeration).
      before: createAuthMiddleware(async (ctx) => {
        if (refuseEmailLinks && EMAIL_LINK_PATHS.includes(ctx.path)) {
          throw emailNotConfiguredError();
        }
      }),
    },
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
