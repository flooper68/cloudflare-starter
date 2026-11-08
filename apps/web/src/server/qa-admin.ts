/**
 * The automated QA suite's self-provisioned admin at the Better Auth edge (QA_BYPASS=on),
 * docs/guides/how-to-configure-abuse-protection.md#the-qa-admin:
 * - QA addresses (`qa@`, `qa+<tag>@` in QA_EMAIL_DOMAIN) can be signed up or taken by an
 *   email change only with the QA token: nobody else can create or claim the QA admin;
 * - `qa+admin@<QA_EMAIL_DOMAIN>` is promoted once verified (promoteBootstrapAdmin, at
 *   verification and at sign-in), recorded as `qa.admin.promoted`; its verification mail
 *   is only in the QA outbox, which only the token reads;
 * - its sessions last at most QA_ADMIN_SESSION_MS;
 * - with QA_BYPASS=off any `qa+admin@` account is demoted at sign-in (`qa.admin.demoted`)
 *   and refused as an admin before that (findAdminAccess).
 */
import {
  type AdminAuthGateway,
  demoteQaAdmin,
  isAnyQaAdminEmail,
  isQaEmail,
  promoteBootstrapAdmin,
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

/** The QA admin's sessions end after this long, whatever the app's default. */
export const QA_ADMIN_SESSION_MS = 60 * 60 * 1000;

/** The code of a refused sign-up or email change to a QA address without the QA token. */
export const QA_ADDRESS_RESERVED = "QA_ADDRESS_RESERVED";

/** Endpoints that give an account an address, and the body field that names it. */
const ADDRESS_FIELDS: Readonly<Record<string, string>> = {
  "/sign-up/email": "email",
  "/change-email": "newEmail",
};

/**
 * `hooks.before`: with QA_BYPASS=on, refuses a sign-up or an email change to a QA address
 * unless the request carries the QA token, so only the QA suite creates QA accounts (and
 * so the QA admin is never someone else's account).
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
  const bypass = buildPlatform(env).qaBypass;
  if (!bypass) return;
  const address = (ctx.body as Record<string, unknown> | undefined)?.[field];
  if (typeof address !== "string" || !isQaEmail(address, bypass.emailDomain))
    return;
  const presented = ctx.headers?.get(QA_TOKEN_HEADER) ?? "";
  if (timingSafeEqual(presented, bypass.token)) return;
  throw new APIError("FORBIDDEN", {
    code: QA_ADDRESS_RESERVED,
    message: "This address is reserved for the automated QA suite.",
  });
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
 * Promotes the QA admin (verified, QA_BYPASS=on) or demotes any QA admin account
 * (QA_BYPASS=off). Runs after each sign-in. Fails open like the bootstrap promotion: the
 * failure is reported, and admin access is refused anyway while the bypass is off.
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
    const bypass = buildPlatform(env).qaBypass;
    const deps = {
      db: getDb(env),
      clock: systemClock,
      ids: randomIds,
      requestContext,
      gateway: auth.gateway,
    };
    if (!bypass) {
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
      qaAdminEmail: qaAdminEmail(bypass.emailDomain),
    });
  } catch (error) {
    buildPlatform(env).errors.capture(error, requestContext, {
      "app.auth.hook": "session.create.after",
    });
  }
}

/** `session.create.before`: a QA admin session lasts at most QA_ADMIN_SESSION_MS. */
export async function shortenQaAdminSession<
  T extends { readonly userId: string; readonly expiresAt: Date },
>(auth: QaAdminAuth, session: T): Promise<{ data: T } | undefined> {
  const user = await auth.findUser(session.userId);
  if (!user || !isAnyQaAdminEmail(user.email)) return undefined;
  const latest = new Date(systemClock.now().getTime() + QA_ADMIN_SESSION_MS);
  if (session.expiresAt <= latest) return undefined;
  return { data: { ...session, expiresAt: latest } };
}
