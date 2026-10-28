import { mcp } from "@better-auth/mcp";
import {
  checkSignUpAllowed,
  deleteWorkspaceFiles,
  LastOwnerError,
  prepareUserDeletion,
  provisionUser,
  randomIds,
  SignUpNotAllowedError,
  schema,
  systemClock,
} from "@cloudflare-starter/features";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { jwt } from "better-auth/plugins";

import type { AppConfig } from "@/lib/config";
import { buildEmailFeature, buildRequiredConfig } from "@/lib/env";
import {
  auditAuthEndpoint,
  auditDatabaseHooks,
  auditPasswordReset,
  contextFor,
} from "@/server/auth-audit";
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
export const APP_NAME = "Cloudflare Starter";

/**
 * Refuses a sign-up the environment's policy does not allow (SIGN_UP, SIGN_UP_DOMAINS,
 * BOOTSTRAP_ADMIN_EMAIL, pending invitations). Runs in `user.create.before`, so it covers
 * every method, Google included; a refused Google sign-up redirects to
 * `/sign-in?error=SIGN_UP_INVITE_ONLY`. A named function so other checks on the same hook
 * (abuse protection) compose with it.
 */
export async function enforceSignUpPolicy(
  env: AppEnv,
  user: { readonly email: string }
): Promise<void> {
  try {
    await checkSignUpAllowed(
      { db: getDb(env), clock: systemClock },
      { email: user.email, settings: buildRequiredConfig(env).workspaces }
    );
  } catch (error) {
    if (error instanceof SignUpNotAllowedError) {
      throw new APIError("FORBIDDEN", {
        code: SignUpNotAllowedError.CODE,
        message: error.message,
      });
    }
    throw error;
  }
}

/**
 * Gives a new user their workspace (provisionUser), right after Better Auth creates them.
 * Fails open like the audit hooks: the account already exists, so a failure (the audit
 * insert included) is reported with the request's trace id and the sign-up succeeds; the
 * app then shows "You are not in a workspace" until it is fixed.
 */
async function provisionNewUser(
  env: AppEnv,
  user: { readonly id: string; readonly email: string },
  ctx: { readonly request?: Request } | null
): Promise<void> {
  const requestContext = { ...contextFor(env, ctx), userId: user.id };
  try {
    await provisionUser(
      { db: getDb(env), clock: systemClock, ids: randomIds, requestContext },
      {
        user,
        settings: buildRequiredConfig(env).workspaces,
        sharedWorkspaceName: APP_NAME,
      }
    );
  } catch (error) {
    buildPlatform(env).errors.capture(error, requestContext, {
      "app.auth.hook": "user.create.after",
    });
  }
}

/**
 * Before a user is deleted: their own workspaces go with their files (R2 objects
 * included), they leave shared ones; refused while they are a workspace's last owner.
 * Runs from `user.deleteUser.beforeDelete` (the deletion endpoint, before anything is
 * deleted) and from `user.delete.before` (every deletion; Better Auth's internal
 * `deleteUser` has removed sessions and accounts by then, so a refusal there signs the
 * user out). Running twice is harmless: the second run finds nothing left to do.
 */
async function prepareAccountDeletion(
  env: AppEnv,
  userId: string,
  ctx: { readonly request?: Request } | null
) {
  const db = getDb(env);
  try {
    await prepareUserDeletion(
      {
        db,
        clock: systemClock,
        ids: randomIds,
        requestContext: contextFor(env, ctx),
        purgeWorkspaceFiles: async (workspaceIds) => {
          await deleteWorkspaceFiles(
            { db, bucket: env.FILES },
            { workspaceIds }
          );
        },
      },
      { userId }
    );
  } catch (error) {
    if (error instanceof LastOwnerError) {
      throw new APIError("BAD_REQUEST", {
        code: "LAST_OWNER",
        message: error.message,
      });
    }
    throw error;
  }
}

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
  const { workspaces } = config;
  if (
    workspaces.mode === "single" &&
    workspaces.signUpDomains.length > 0 &&
    methods.emailPassword &&
    !methods.requireEmailVerification
  ) {
    // Anyone could claim an address on the domain and join the app's workspace.
    throw new Error(
      "SIGN_UP_DOMAINS in single mode trusts the email domain: set AUTH_REQUIRE_EMAIL_VERIFICATION=true (or turn off AUTH_EMAIL_PASSWORD and use Google)"
    );
  }
  if (
    workspaces.bootstrapAdminEmail &&
    methods.emailPassword &&
    !methods.requireEmailVerification
  ) {
    // Whoever signs up first with that address would get its rights.
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL needs AUTH_REQUIRE_EMAIL_VERIFICATION=true (or AUTH_EMAIL_PASSWORD=false and Google sign-in)"
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

  const audit = auditDatabaseHooks(env);

  return {
    appName: APP_NAME,
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
      // Audit log: a completed reset (server/auth-audit.ts).
      onPasswordReset: ({ user }, request) =>
        auditPasswordReset(env, user.id, request),
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
    user: {
      deleteUser: {
        // Off: no account-deletion UI yet. When a project turns it on, this check runs
        // before Better Auth deletes sessions and accounts, so a refused deletion (last
        // owner) leaves the user able to sign in and hand over first.
        enabled: false,
        beforeDelete: async (user, request) => {
          await prepareAccountDeletion(env, user.id, { request });
        },
      },
    },
    databaseHooks: {
      // Audit log: sign-ins (server/auth-audit.ts).
      session: audit.session,
      user: {
        create: {
          before: async (user) => {
            await enforceSignUpPolicy(env, user);
          },
          after: async (user, ctx) => {
            await provisionNewUser(env, user, ctx);
            // Audit log: sign-ups (server/auth-audit.ts).
            await audit.user?.create?.after?.(user, ctx);
          },
        },
        delete: {
          before: async (user, ctx) => {
            await prepareAccountDeletion(env, user.id, ctx);
          },
        },
      },
    },
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
