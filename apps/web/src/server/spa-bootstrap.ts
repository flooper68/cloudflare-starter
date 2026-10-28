/**
 * The JSON the `/app` and `/admin` pages hand the SPA (`__APP_AUTH__`, read by
 * components/shared/spa/auth-context.tsx): the user, sign-in methods, workspace mode,
 * the billing mode, whether they may open the admin portal, and whether this session is
 * an impersonation.
 */
import { findAdminAccess, systemClock } from "@cloudflare-starter/features";

import { buildRequiredConfig } from "@/lib/env";
import { getAuthMethods } from "@/server/auth";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";

export interface SpaBootstrap {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly image: string | null;
  } | null;
  readonly methods: { readonly emailPassword: boolean };
  readonly workspace: { readonly mode: "personal" | "single" | "multi" };
  /** BILLING: off hides the billing page and every upgrade prompt. */
  readonly billing: { readonly mode: "off" | "manual" | "provider" };
  /** Role admin, not suspended, and ADMIN_PORTAL=on (read from D1, not the cookie cache). */
  readonly admin: boolean;
  /** Set while an admin impersonates this user: the admin's user id. */
  readonly impersonatedBy: string | null;
}

/**
 * The bootstrap as the body of `<script type="application/json">`. Names and other user
 * data could contain `</script>`; escaping `<` (and the JS line separators) keeps them
 * data, so a user's profile cannot run script in an admin's browser while impersonated.
 */
export function serializeBootstrap(bootstrap: SpaBootstrap): string {
  return JSON.stringify(bootstrap)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export async function spaBootstrap(
  env: AppEnv,
  locals: Pick<App.Locals, "user" | "session">
): Promise<SpaBootstrap> {
  const config = buildRequiredConfig(env);
  const { user, session } = locals;
  const admin =
    config.ADMIN_PORTAL === "on" && user !== null
      ? (
          await findAdminAccess(
            { db: getDb(env), clock: systemClock },
            { userId: user.id }
          )
        ).isAdmin
      : false;
  return {
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
        }
      : null,
    methods: { emailPassword: getAuthMethods(env).emailPassword },
    workspace: { mode: config.workspaces.mode },
    billing: { mode: config.billing.mode },
    admin,
    impersonatedBy: session?.impersonatedBy ?? null,
  };
}
