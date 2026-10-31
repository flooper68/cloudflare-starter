/**
 * The admin portal's AdminAuthGateway (packages/features/src/admin/ports) over Better Auth
 * 1.7.14: the one file that knows how the admin plugin and the internal adapter work. Its
 * HTTP endpoints are closed (ADMIN_HTTP_PATHS); writes go through `auth.$context`'s
 * internal adapter (so hooks and session caches stay right) and impersonation through
 * `auth.api` with the browser's headers. Re-check this file when upgrading Better Auth.
 */
import {
  type AdminAuthGateway,
  PasswordResetUnavailableError,
  type PlatformRole,
} from "@cloudflare-starter/features";
import { isAPIError } from "better-auth/api";

import type { Auth } from "@/server/auth";

/** The browser request a call runs for: its headers in, the response's headers out. */
export interface BrowserExchange {
  readonly headers: Headers;
  readonly resHeaders: Headers;
}

/** Thrown when impersonation is attempted without a browser session (MCP). */
export class BrowserSessionRequiredError extends Error {
  constructor() {
    super("Impersonation needs a browser session");
    this.name = "BrowserSessionRequiredError";
  }
}

/** Copies the cookies Better Auth set onto the response the browser gets. */
function forwardCookies(from: Headers, to: Headers) {
  for (const cookie of from.getSetCookie()) to.append("set-cookie", cookie);
}

/**
 * `auth` returns the Better Auth instance (`() => getAuth(env)`); a function, so the auth
 * config's own hooks can build a gateway too.
 */
export function createAdminAuthGateway(
  auth: () => Auth,
  browser: BrowserExchange | null
): AdminAuthGateway {
  const adapter = async () => (await auth().$context).internalAdapter;
  const requireBrowser = () => {
    if (!browser) throw new BrowserSessionRequiredError();
    return browser;
  };

  return {
    async resetSecondFactor(userId) {
      const context = await auth().$context;
      await context.internalAdapter.deleteUserSessions(userId);
      for (const model of [
        "twoFactor",
        "oauthAccessToken",
        "oauthRefreshToken",
      ])
        await context.adapter.deleteMany({
          model,
          where: [{ field: "userId", value: userId }],
        });
      await context.adapter.deleteMany({
        model: "verification",
        where: [{ field: "value", value: userId }],
      });
      await context.internalAdapter.updateUser(userId, {
        twoFactorEnabled: false,
      });
    },
    async setRole(userId: string, role: PlatformRole) {
      await (await adapter()).updateUser(userId, { role });
    },
    async ban(userId, input) {
      await (await adapter()).updateUser(userId, {
        banned: true,
        banReason: input.reason,
        banExpires: input.expiresAt,
      });
    },
    async unban(userId) {
      await (await adapter()).updateUser(userId, {
        banned: false,
        banReason: null,
        banExpires: null,
      });
    },
    async revokeSessions(userId) {
      const internal = await adapter();
      const sessions = await internal.listSessions(userId);
      await internal.deleteUserSessions(userId);
      return sessions.length;
    },
    async deleteUser(userId, operationId) {
      // Explicit server-owned identity survives both library hooks. Separate calls never share it.
      await auth().withErasureOperation(
        operationId ?? crypto.randomUUID(),
        async () => {
          await (await adapter()).deleteUser(userId);
        }
      );
    },
    async sendPasswordReset(email, redirectTo) {
      try {
        await auth().api.requestPasswordReset({ body: { email, redirectTo } });
      } catch (error) {
        if (isAPIError(error) && error.body?.code === "EMAIL_NOT_CONFIGURED") {
          throw new PasswordResetUnavailableError(
            error.body.message ?? "Email is not configured"
          );
        }
        throw error;
      }
    },
    async startImpersonation(userId) {
      const { headers, resHeaders } = requireBrowser();
      const result = await auth().api.impersonateUser({
        body: { userId },
        headers,
        returnHeaders: true,
      });
      forwardCookies(result.headers, resHeaders);
    },
    async stopImpersonation() {
      const { headers, resHeaders } = requireBrowser();
      const result = await auth().api.stopImpersonating({
        headers,
        returnHeaders: true,
      });
      forwardCookies(result.headers, resHeaders);
    },
  };
}
