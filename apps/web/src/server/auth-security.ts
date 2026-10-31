/** Better Auth 1.7.14 adapter: policies and assurance run at the verified endpoint boundary. */

import { passkey } from "@better-auth/passkey";
import {
  getSecurityState,
  notify,
  randomIds,
  recordAuditEvent,
  type SecuritySettings,
  securityFactorChangedNotification,
  systemClock,
} from "@cloudflare-starter/features";
import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { twoFactor } from "better-auth/plugins";
import { buildEmailFeature, buildRequiredConfig } from "@/lib/env";
import { auditCompletedSignIn, contextFor } from "./auth-audit";
import { getDb } from "./db";
import type { AppEnv } from "./env";
import { buildPlatform } from "./platform";

const VERIFY = [
  "/two-factor/verify-totp",
  "/two-factor/verify-otp",
  "/two-factor/verify-backup-code",
];
const PRIMARY = [
  "/sign-in/email",
  "/sign-in/social",
  "/sign-up/email",
  "/verify-email",
  "/passkey/verify-authentication",
  "/passkey/verify-registration",
];
const RECOVERY = [
  "/get-session",
  "/sign-out",
  "/two-factor/enable",
  "/two-factor/send-otp",
  ...VERIFY,
];

export const assuranceFields = {
  amr: { type: "string", required: false, input: false, defaultValue: "" },
  secondFactorAt: { type: "date", required: false, input: false },
} as const;

export function securityError(
  decision: "enrollment_required" | "step_up_required"
): APIError {
  return new APIError("FORBIDDEN", {
    code:
      decision === "enrollment_required"
        ? "SECOND_FACTOR_ENROLLMENT_REQUIRED"
        : "STEP_UP_REQUIRED",
    message:
      decision === "enrollment_required"
        ? "Set up two-factor authentication to continue."
        : "Verify a second factor to continue.",
  });
}

/** Native plugins always own the schema; deployment settings close their HTTP endpoints. */
export function securityPlugins(env: AppEnv, settings: SecuritySettings) {
  const config = buildRequiredConfig(env);
  const factors = twoFactor({
    issuer: "Cloudflare Starter",
    allowPasswordless: true,
    trustDeviceMaxAge: settings.trustedDeviceDays * 86_400,
    accountLockout: {
      enabled: true,
      maxFailedAttempts: 10,
      durationSeconds: 900,
    },
    backupCodeOptions: { storeBackupCodes: "encrypted" },
    ...(settings.emailOtp
      ? {
          otpOptions: {
            sendOTP: async ({
              user,
              otp,
            }: {
              user: { email: string; name: string };
              otp: string;
            }) => {
              const email = buildEmailFeature(env);
              if (!email.value)
                throw new APIError("PRECONDITION_FAILED", {
                  code: "EMAIL_NOT_CONFIGURED",
                  message: "Email verification codes are unavailable.",
                });
              await email.value.send({
                to: user,
                subject: "Your verification code",
                text: `Your verification code is ${otp}. It expires in three minutes.`,
                html: `<p>Your verification code is <strong>${otp}</strong>. It expires in three minutes.</p>`,
              });
            },
          },
        }
      : {}),
  });
  // The stock plugin challenges password logins only. Use its same challenge and lockout
  // implementation after social and passkey sign-in, rather than inventing a second one.
  const factorHook = factors.hooks.after[0];
  const guardedFactors = {
    ...factors,
    hooks: {
      after: [
        {
          ...factorHook,
          matcher: (ctx: Parameters<typeof factorHook.matcher>[0]) =>
            settings.mode !== "off" &&
            (factorHook.matcher(ctx) ||
              ctx.path?.startsWith("/callback/") ||
              ctx.path === "/verify-email" ||
              ctx.path === "/sign-in/social" ||
              ctx.path === "/passkey/verify-authentication" ||
              ctx.path === "/passkey/verify-registration"),
        },
      ],
    },
  };
  const keys = passkey({
    rpID: new URL(config.APP_URL).hostname,
    rpName: "Cloudflare Starter",
    origin: config.APP_URL,
  });
  return { factors: guardedFactors, keys };
}

/** No factor removal, account mutation or OAuth grant can bypass an incomplete session. */
export async function enforceAuthSecurity(
  env: AppEnv,
  ctx: GenericEndpointContext
): Promise<void> {
  const settings = buildRequiredConfig(env).security;
  if (ctx.path.startsWith("/two-factor/")) {
    if (settings.mode === "off")
      throw new APIError("NOT_FOUND", { message: "Not found" });
    if (
      !settings.emailOtp &&
      ["/two-factor/send-otp", "/two-factor/verify-otp"].includes(ctx.path)
    )
      throw new APIError("NOT_FOUND", { message: "Not found" });
    if (!settings.trustedDeviceDays && ctx.body?.trustDevice)
      throw new APIError("BAD_REQUEST", {
        message: "Trusted devices are disabled.",
      });
    // Enroll TOTP first. Email OTP is recovery, never an unverified enrollment shortcut.
    if (ctx.path === "/two-factor/enable" && ctx.body?.method === "otp")
      throw new APIError("BAD_REQUEST", {
        message: "Set up an authenticator app first.",
      });
  }
  if (ctx.path.startsWith("/passkey/") && !settings.passkeys)
    throw new APIError("NOT_FOUND", { message: "Not found" });
  if (settings.trustedDeviceDays === 0) {
    const cookie = ctx.context.createAuthCookie("trust_device");
    const trust = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
    const identifier =
      typeof trust === "string" ? trust.split("!")[1] : undefined;
    if (identifier)
      await ctx.context.internalAdapter.deleteVerificationByIdentifier(
        identifier
      );
  }
  const current = await getSessionFromCtx(ctx);
  if (["/two-factor/send-otp", "/two-factor/verify-otp"].includes(ctx.path)) {
    // An anonymous challenge has a signed, server-backed user reference. A cookie's
    // cached enrollment flag never authorizes email recovery or creates enrollment.
    let userId = current?.user.id;
    if (!userId) {
      const cookie = ctx.context.createAuthCookie("two_factor");
      const identifier = await ctx.getSignedCookie(
        cookie.name,
        ctx.context.secret
      );
      const challenge =
        typeof identifier === "string"
          ? await ctx.context.internalAdapter.findVerificationValue(identifier)
          : null;
      if (challenge && new Date(challenge.expiresAt).getTime() > Date.now())
        userId = challenge.value;
    }
    const factor = userId
      ? await ctx.context.adapter.findOne<{ verified: boolean }>({
          model: "twoFactor",
          where: [{ field: "userId", value: userId }],
        })
      : null;
    const person = userId
      ? await ctx.context.adapter.findOne<{ twoFactorEnabled: boolean }>({
          model: "user",
          select: ["twoFactorEnabled"],
          where: [{ field: "id", value: userId }],
        })
      : null;
    if (factor?.verified !== true || person?.twoFactorEnabled !== true)
      throw securityError("enrollment_required");
  }
  if (!current) return;
  if (VERIFY.includes(ctx.path)) {
    const factor = await ctx.context.adapter.findOne<{
      id: string;
      lockedUntil: Date | null;
    }>({
      model: "twoFactor",
      where: [{ field: "userId", value: current.user.id }],
    });
    if (
      factor?.lockedUntil &&
      new Date(factor.lockedUntil).getTime() > Date.now()
    )
      throw new APIError("TOO_MANY_REQUESTS", {
        code: "ACCOUNT_TEMPORARILY_LOCKED",
        message: "Too many verification attempts. Try again in 15 minutes.",
      });
    if (factor?.lockedUntil)
      await ctx.context.adapter.update({
        model: "twoFactor",
        where: [
          { field: "id", value: factor.id },
          { field: "lockedUntil", operator: "lte", value: new Date() },
        ],
        update: { failedVerificationCount: 0, lockedUntil: null },
      });
  }
  const state = await getSecurityState(
    { db: getDb(env), clock: systemClock },
    { userId: current.user.id, sessionId: current.session.id, settings }
  );
  if (
    ctx.path === "/two-factor/get-totp-uri" &&
    state.enrolled &&
    (!state.verified ||
      !state.freshFactor ||
      !state.secondFactorAt ||
      Date.now() - new Date(state.secondFactorAt).getTime() > 15 * 60_000)
  )
    throw securityError("step_up_required");
  if (ctx.path === "/two-factor/disable" && state.required) {
    throw new APIError("FORBIDDEN", {
      code: "SECOND_FACTOR_REQUIRED",
      message: "Your account requires a second factor.",
    });
  }
  if (!state.sessionValid)
    throw new APIError("UNAUTHORIZED", {
      message: "Session expired. Sign in again.",
    });
  if (state.decision !== "allowed" && !RECOVERY.includes(ctx.path))
    throw securityError(state.decision);
}

/** Runs LAST: native factor hooks have removed incomplete sign-in sessions by now. */
export function authAssurance(env: AppEnv): BetterAuthPlugin {
  return {
    id: "auth-assurance",
    hooks: {
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            // Native lockout covers anonymous sign-in challenges. Cover signed-in step-up too.
            if (VERIFY.includes(ctx.path) && ctx.context.session) {
              const userId = ctx.context.session.user.id;
              const currentFactor = await ctx.context.adapter.findOne<{
                id: string;
              }>({
                model: "twoFactor",
                where: [{ field: "userId", value: userId }],
              });
              if (
                currentFactor &&
                isAPIError(returned) &&
                ["INVALID_CODE", "INVALID_BACKUP_CODE"].includes(
                  String(returned.body?.code)
                )
              ) {
                const factor = await ctx.context.adapter.incrementOne<{
                  id: string;
                  failedVerificationCount: number;
                }>({
                  model: "twoFactor",
                  where: [{ field: "userId", value: userId }],
                  increment: { failedVerificationCount: 1 },
                });
                if (factor && factor.failedVerificationCount >= 10)
                  await ctx.context.adapter.update({
                    model: "twoFactor",
                    where: [{ field: "id", value: factor.id }],
                    update: { lockedUntil: new Date(Date.now() + 900_000) },
                  });
              } else if (currentFactor && !isAPIError(returned))
                await ctx.context.adapter.update({
                  model: "twoFactor",
                  where: [{ field: "userId", value: userId }],
                  update: { failedVerificationCount: 0, lockedUntil: null },
                });
            }
            if (isAPIError(returned) && returned.status !== "FOUND") return;
            if (
              ctx.path?.startsWith("/callback/") &&
              !ctx.context.newSession &&
              returned &&
              typeof returned === "object" &&
              "twoFactorRedirect" in returned
            ) {
              const destination = ctx.context.responseHeaders?.get("location");
              const origin = buildRequiredConfig(env).APP_URL;
              const next =
                destination &&
                new URL(destination, origin).origin === new URL(origin).origin
                  ? new URL(destination, origin).pathname +
                    new URL(destination, origin).search
                  : "/app/dashboard";
              throw ctx.redirect(
                `/two-factor?next=${encodeURIComponent(next)}`
              );
            }
            const change =
              ctx.path === "/two-factor/disable"
                ? "disabled"
                : ctx.path === "/two-factor/generate-backup-codes"
                  ? "backup_regenerated"
                  : ctx.path === "/passkey/verify-registration"
                    ? "passkey_added"
                    : ctx.path === "/passkey/delete-passkey"
                      ? "passkey_removed"
                      : ctx.path === "/two-factor/verify-totp" &&
                          ctx.context.newSession &&
                          ctx.context.session &&
                          !ctx.context.session.user.twoFactorEnabled
                        ? "enabled"
                        : null;
            const changedUser =
              ctx.context.newSession?.user ?? ctx.context.session?.user;
            if (change && changedUser && !isAPIError(returned)) {
              const requestContext = {
                ...contextFor(env, ctx),
                userId: changedUser.id,
              };
              await recordAuditEvent(
                { db: getDb(env), clock: systemClock, ids: randomIds },
                requestContext,
                {
                  action: "auth.factor_changed",
                  actor: { kind: "user", userId: changedUser.id },
                  target: { type: "user", id: changedUser.id },
                  metadata: { change },
                }
              );
              const platform = buildPlatform(env);
              await notify(
                {
                  jobQueue: platform.jobQueue,
                  clock: systemClock,
                  ids: randomIds,
                  errors: platform.errors,
                },
                securityFactorChangedNotification,
                {
                  recipients: [changedUser.id],
                  data: { change: change.replaceAll("_", " ") },
                  context: { workspaceId: null, requestContext },
                }
              );
            }
            const verified = VERIFY.includes(ctx.path);
            const primary =
              PRIMARY.includes(ctx.path) || ctx.path?.startsWith("/callback/");
            if (!verified && !primary) return;
            // `newSession` is null during native 2FA challenge. Never use an unrelated session
            // left on the context to authenticate an incomplete primary sign-in.
            const current = verified
              ? (ctx.context.newSession ?? ctx.context.session)
              : ctx.context.newSession;
            if (!current) return;
            const settings = buildRequiredConfig(env).security;
            const enrolled =
              (current.user as { twoFactorEnabled?: boolean })
                .twoFactorEnabled === true;
            const remembered = !verified && enrolled && settings.mode !== "off";
            const amr = verified
              ? "otp mfa"
              : remembered
                ? "mfa"
                : ctx.path === "/sign-in/email"
                  ? "pwd"
                  : "";
            const updated = await ctx.context.internalAdapter.updateSession(
              current.session.token,
              {
                amr,
                secondFactorAt: verified || remembered ? new Date() : null,
              }
            );
            if (!updated)
              throw new APIError("UNAUTHORIZED", {
                message: "Session expired. Sign in again.",
              });
            const newSignIn = Boolean(ctx.context.newSession);
            await setSessionCookie(ctx, {
              session: updated,
              user: current.user,
            });
            if (newSignIn) await auditCompletedSignIn(env, ctx, updated);
            if (verified)
              await recordAuditEvent(
                { db: getDb(env), clock: systemClock, ids: randomIds },
                contextFor(env, ctx),
                {
                  action: "auth.second_factor_verified",
                  actor: { kind: "user", userId: current.user.id },
                  target: { type: "user", id: current.user.id },
                  metadata: {
                    method: ctx.path.endsWith("verify-backup-code")
                      ? "backup"
                      : ctx.path.endsWith("verify-otp")
                        ? "email"
                        : "totp",
                  },
                }
              );
          }),
        },
      ],
    },
  };
}
