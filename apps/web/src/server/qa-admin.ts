/**
 * The automated QA suite's self-provisioned admin at the Better Auth edge (QA_BYPASS=on),
 * docs/reference/abuse-protection.md#the-qa-admin:
 * - QA addresses (`qa@`, `qa+<tag>@` in QA_EMAIL_DOMAIN) can be signed up, taken by an
 *   email change or created by any other sign-in method (Google) only with the QA token,
 *   and never linked to a social account: nobody else can create or claim the QA admin;
 * - `qa+admin@<QA_EMAIL_DOMAIN>` is promoted once verified (promoteBootstrapAdmin, at
 *   verification and at sign-in), recorded as `qa.admin.promoted`; its verification mail
 *   is only in the QA outbox, which only the token reads;
 * - it is an admin only within QA_ADMIN_SESSION_MS of a browser sign-in (findAdminAccess),
 *   and its sessions are created that short;
 * - any other `qa+admin@` account (QA_BYPASS=off, or an old QA_EMAIL_DOMAIN) is refused as
 *   an admin (findAdminAccess) and demoted, its sessions revoked, at sign-in
 *   (`qa.admin.demoted`).
 */
import {
  type AdminAuthGateway,
  demoteQaAdmin,
  isAnyQaAdminEmail,
  isQaAdminEmail,
  isQaEmail,
  promoteBootstrapAdmin,
  QA_ADMIN_SESSION_MS,
  QA_TOKEN_HEADER,
  qaAdminEmail,
  randomIds,
  systemClock,
  timingSafeEqual,
} from "@cloudflare-starter/features";
import { APIError } from "better-auth/api";

import { contextFor } from "@/server/auth-audit";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";

/** The code of a refused sign-up or email change to a QA address without the QA token. */
export const QA_ADDRESS_RESERVED = "QA_ADDRESS_RESERVED";

/** Endpoints that give an account an address, and the body field that names it. */
const ADDRESS_FIELDS: Readonly<Record<string, string>> = {
  "/sign-up/email": "email",
  "/change-email": "newEmail",
};

/** The QA admin's address while QA_BYPASS=on, else null. */
export function currentQaAdminEmail(env: AppEnv): string | null {
  const bypass = buildPlatform(env).qaBypass;
  return bypass ? qaAdminEmail(bypass.emailDomain) : null;
}

function reserved(): APIError {
  return new APIError("FORBIDDEN", {
    code: QA_ADDRESS_RESERVED,
    message: "This address is reserved for the automated QA suite.",
  });
}

/** Whether a request may give an account `address`: not a QA address, or with the token. */
function mayUseAddress(
  env: AppEnv,
  address: unknown,
  headers: Headers | undefined
): boolean {
  const bypass = buildPlatform(env).qaBypass;
  if (!bypass) return true;
  if (typeof address !== "string" || !isQaEmail(address, bypass.emailDomain))
    return true;
  const presented = headers?.get(QA_TOKEN_HEADER) ?? "";
  return timingSafeEqual(presented, bypass.token);
}

/**
 * `hooks.before`: with QA_BYPASS=on, refuses a sign-up or an email change to a QA address
 * unless the request carries the QA token, so only the QA suite creates QA accounts.
 */
export function refuseQaAddressWithoutToken(
  env: AppEnv,
  ctx: {
    readonly path: string;
    readonly headers?: Headers;
    readonly body?: unknown;
  }
): void {
  const field = ADDRESS_FIELDS[ctx.path];
  if (!field) return;
  const address = (ctx.body as Record<string, unknown> | undefined)?.[field];
  if (!mayUseAddress(env, address, ctx.headers)) throw reserved();
}

/**
 * `user.create.before`, for every sign-in method (Google too): a QA address only with the
 * QA token on the request that creates the user.
 */
export function refuseQaUserWithoutToken(
  env: AppEnv,
  user: { readonly email: string },
  ctx: { readonly headers?: Headers; readonly request?: Request } | null
): void {
  const headers = ctx?.headers ?? ctx?.request?.headers;
  if (!mayUseAddress(env, user.email, headers)) throw reserved();
}

/** What the hooks need from Better Auth; server/auth.ts passes it (no import cycle). */
export interface QaAdminAuth {
  readonly findUser: (userId: string) => Promise<{
    readonly id: string;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly role?: string | null;
  } | null>;
  readonly gateway: AdminAuthGateway;
}

/**
 * `account.create.before`: with QA_BYPASS=on, no social account (Google) is linked to a
 * QA address's user: such an account only ever signs in with its password.
 */
export async function refuseSocialQaAccount(
  env: AppEnv,
  auth: QaAdminAuth,
  account: { readonly userId: string; readonly providerId: string }
): Promise<void> {
  if (account.providerId === "credential") return;
  const bypass = buildPlatform(env).qaBypass;
  if (!bypass) return;
  const user = await auth.findUser(account.userId);
  if (user && isQaEmail(user.email, bypass.emailDomain)) throw reserved();
}

/**
 * After each sign-in: promotes the current QA admin once verified (QA_BYPASS=on), demotes
 * any other QA admin account. Fails open like the bootstrap promotion: the failure is
 * reported, and findAdminAccess refuses a stale QA admin anyway.
 */
export async function syncQaAdminRole(
  env: AppEnv,
  auth: QaAdminAuth,
  userId: string,
  ctx: { readonly request?: Request } | null
): Promise<void> {
  const requestContext = contextFor(env, ctx);
  try {
    const user = await auth.findUser(userId);
    if (!user || !isAnyQaAdminEmail(user.email)) return;
    const current = currentQaAdminEmail(env);
    const deps = {
      db: getDb(env),
      clock: systemClock,
      ids: randomIds,
      requestContext,
      gateway: auth.gateway,
    };
    if (!current || user.email.trim().toLowerCase() !== current) {
      await demoteQaAdmin(deps, { userId });
      return;
    }
    await promoteBootstrapAdmin(deps, {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role ?? null,
      },
      bootstrapAdminEmail: null,
      qaAdminEmail: current,
    });
  } catch (error) {
    buildPlatform(env).errors.capture(error, requestContext, {
      "app.auth.hook": "session.create.after",
    });
  }
}

/**
 * `session.create.before`: the current QA admin's sessions are created QA_ADMIN_SESSION_MS
 * long. (Better Auth may extend a session later; the admin power still ends then, since
 * findAdminAccess counts from the sign-in.) Nobody else's.
 */
export async function shortenQaAdminSession<
  T extends { readonly userId: string; readonly expiresAt: Date },
>(
  env: AppEnv,
  auth: QaAdminAuth,
  session: T
): Promise<{ data: T } | undefined> {
  const bypass = buildPlatform(env).qaBypass;
  if (!bypass) return undefined;
  const user = await auth.findUser(session.userId);
  if (!user || !isQaAdminEmail(user.email, bypass.emailDomain))
    return undefined;
  const latest = new Date(systemClock.now().getTime() + QA_ADMIN_SESSION_MS);
  if (session.expiresAt <= latest) return undefined;
  return { data: { ...session, expiresAt: latest } };
}
