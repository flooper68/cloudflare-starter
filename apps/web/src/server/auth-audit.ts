/**
 * Audit events for Better Auth's own endpoints, which are not our use cases: sign-in,
 * failed sign-in, sign-up, password reset requests and password changes (docs/guides/how-to-use-the-audit-log.md).
 * Wired into the auth options in server/auth.ts. A failure to record is reported and does
 * not fail the sign-in: losing an audit row is better than locking every user out.
 */
import {
  type AuditEventInput,
  createRequestContext,
  type RequestContext,
  randomIds,
  recordAuditEvent,
  systemClock,
} from "@cloudflare-starter/features";
import type { BetterAuthOptions, GenericEndpointContext } from "better-auth";
import { isAPIError } from "better-auth/api";

import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";
import { currentRequestContext } from "@/server/request-scope";

type SignInMethod = "password" | "social" | "sign_up" | "email_verification";

/** How the session was created, from the Better Auth endpoint that created it. */
function signInMethodOf(ctx: GenericEndpointContext | null): {
  readonly method: SignInMethod | "other";
  readonly provider?: string;
} {
  const path = ctx?.path ?? "";
  if (path === "/sign-in/email") return { method: "password" };
  if (path === "/sign-up/email") return { method: "sign_up" };
  if (path === "/verify-email") return { method: "email_verification" };
  if (path.startsWith("/callback/") || path === "/sign-in/social") {
    const provider = ctx?.params?.id ?? ctx?.body?.provider;
    return typeof provider === "string"
      ? { method: "social", provider }
      : { method: "social" };
  }
  return { method: "other" };
}

/** Better Auth's error code (INVALID_PASSWORD), or the HTTP status when it has none. */
function errorCodeOf(error: {
  readonly body?: unknown;
  readonly status: unknown;
}): string {
  const code = (error.body as { code?: unknown } | undefined)?.code;
  return String(code ?? error.status).slice(0, 200);
}

/** The email an anonymous request was about, normalized, or null when it named none. */
function emailOf(ctx: { readonly body?: unknown }): string | null {
  const email = (ctx.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase().slice(0, 320)
    : null;
}

/**
 * The current request's context; a fresh one when Better Auth is called outside the HTTP
 * edge. Also used by server/auth.ts for the use cases its database hooks run.
 */
export function contextFor(
  env: AppEnv,
  ctx: { readonly request?: Request } | null
): RequestContext {
  const current = currentRequestContext();
  if (current) return current;
  const platform = buildPlatform(env);
  return createRequestContext(
    { ids: randomIds },
    {
      source: "http",
      release: platform.release,
      environment: platform.environment,
      ip: ctx?.request?.headers.get("cf-connecting-ip") ?? null,
    }
  );
}

async function record(
  env: AppEnv,
  ctx: { readonly request?: Request } | null,
  event: AuditEventInput
): Promise<void> {
  const context = contextFor(env, ctx);
  try {
    await recordAuditEvent(
      { db: getDb(env), clock: systemClock, ids: randomIds },
      context,
      event
    );
  } catch (error) {
    buildPlatform(env).errors.capture(error, context, {
      "app.audit.action": event.action,
    });
  }
}

/** Better Auth database hooks: a session or a user was created. */
export function auditDatabaseHooks(
  env: AppEnv
): NonNullable<BetterAuthOptions["databaseHooks"]> {
  return {
    session: {
      create: {
        async after(session, ctx) {
          // A password change re-issues the session: recorded as auth.password_changed.
          if (ctx?.path === "/change-password") return;
          await record(env, ctx, {
            action: "auth.sign_in",
            actor: { kind: "user", userId: session.userId },
            target: { type: "user", id: session.userId },
            metadata: signInMethodOf(ctx),
          });
        },
      },
    },
    user: {
      create: {
        async after(user, ctx) {
          const { method, provider } = signInMethodOf(ctx);
          await record(env, ctx, {
            action: "auth.sign_up",
            actor: { kind: "user", userId: user.id },
            target: { type: "user", id: user.id },
            metadata: {
              method:
                method === "sign_up"
                  ? "password"
                  : method === "social"
                    ? "social"
                    : "other",
              ...(provider ? { provider } : {}),
            },
          });
        },
      },
    },
  };
}

/**
 * Runs after every Better Auth endpoint (`hooks.after`), including ones that answered with
 * an error (`ctx.context.returned` is then the APIError): records failed email sign-ins,
 * accepted password reset requests and password changes by a signed-in user.
 */
export async function auditAuthEndpoint(
  env: AppEnv,
  ctx: GenericEndpointContext
): Promise<void> {
  // Set by Better Auth's dispatcher before after-hooks run; not in its public context type.
  const { returned } = ctx.context as { readonly returned?: unknown };

  if (ctx.path === "/change-password") {
    const userId = ctx.context.session?.user.id;
    if (!userId) return;
    await record(env, ctx, {
      action: "auth.password_changed",
      outcome: isAPIError(returned) ? "failure" : "success",
      actor: { kind: "user", userId },
      target: { type: "user", id: userId },
      metadata: isAPIError(returned)
        ? { method: "change", reason: errorCodeOf(returned) }
        : { method: "change" },
    });
    return;
  }

  const email = emailOf(ctx);
  if (!email) return;

  if (ctx.path === "/sign-in/email" && isAPIError(returned)) {
    await record(env, ctx, {
      action: "auth.sign_in_failed",
      actor: { kind: "user", userId: null },
      target: { type: "email", id: email },
      metadata: { method: "password", reason: errorCodeOf(returned) },
    });
    return;
  }

  if (ctx.path === "/request-password-reset" && !isAPIError(returned)) {
    await record(env, ctx, {
      action: "auth.password_reset_requested",
      actor: { kind: "user", userId: null },
      target: { type: "email", id: email },
    });
  }
}

/**
 * A human check (Turnstile) refused sign-up, sign-in or a password reset request. Recorded
 * only when the request named an email, the target of the attempt.
 */
export async function auditHumanCheckFailed(
  env: AppEnv,
  ctx: { readonly body?: unknown; readonly request?: Request },
  form: "sign-up" | "sign-in" | "password-reset",
  reason: "missing" | "rejected" | "unavailable"
): Promise<void> {
  const email = emailOf(ctx);
  if (!email) return;
  await record(env, ctx, {
    action: "auth.human_check_failed",
    actor: { kind: "user", userId: null },
    target: { type: "email", id: email },
    metadata: { form, reason },
  });
}

/**
 * Better Auth's `emailAndPassword.onPasswordReset`: a reset through an emailed link
 * completed. The request carries only the token, so the user comes from Better Auth.
 */
export async function auditPasswordReset(
  env: AppEnv,
  userId: string,
  request: Request | undefined
): Promise<void> {
  await record(
    env,
    { request },
    {
      action: "auth.password_changed",
      actor: { kind: "user", userId },
      target: { type: "user", id: userId },
      metadata: { method: "reset" },
    }
  );
}
