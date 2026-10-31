import { env } from "cloudflare:workers";

import type { AdminAuthGateway, PlatformRole } from "../src";

/** One call the use case made, in order. */
export type GatewayCall =
  | { readonly op: "resetSecondFactor"; readonly userId: string }
  | { readonly op: "setRole"; readonly userId: string; readonly role: string }
  | {
      readonly op: "ban";
      readonly userId: string;
      readonly reason: string | null;
      readonly expiresAt: string | null;
    }
  | { readonly op: "unban"; readonly userId: string }
  | { readonly op: "revokeSessions"; readonly userId: string }
  | { readonly op: "deleteUser"; readonly userId: string }
  | {
      readonly op: "sendPasswordReset";
      readonly email: string;
      readonly redirectTo: string;
    }
  | { readonly op: "startImpersonation"; readonly userId: string }
  | { readonly op: "stopImpersonation" };

/**
 * The admin portal's auth gateway for integration tests: records every call and applies
 * it to the test D1 the way Better Auth's internal adapter would (role, ban columns,
 * session and user rows), so a use case's later reads see the change.
 */
export function memoryAdminAuthGateway(
  options: { readonly failPasswordReset?: Error } = {}
): AdminAuthGateway & { readonly calls: GatewayCall[] } {
  const calls: GatewayCall[] = [];
  const run = (query: string, ...params: unknown[]) =>
    env.DB.prepare(query)
      .bind(...params)
      .run();
  return {
    calls,
    async resetSecondFactor(userId) {
      calls.push({ op: "resetSecondFactor", userId });
      await run("DELETE FROM session WHERE user_id = ?", userId);
      await run("DELETE FROM two_factor WHERE user_id = ?", userId);
      await run("UPDATE user SET two_factor_enabled = 0 WHERE id = ?", userId);
    },
    async setRole(userId: string, role: PlatformRole) {
      calls.push({ op: "setRole", userId, role });
      await run("UPDATE user SET role = ? WHERE id = ?", role, userId);
    },
    async ban(userId, input) {
      calls.push({
        op: "ban",
        userId,
        reason: input.reason,
        expiresAt: input.expiresAt?.toISOString() ?? null,
      });
      await run(
        "UPDATE user SET banned = 1, ban_reason = ?, ban_expires = ? WHERE id = ?",
        input.reason,
        input.expiresAt?.getTime() ?? null,
        userId
      );
    },
    async unban(userId) {
      calls.push({ op: "unban", userId });
      await run(
        "UPDATE user SET banned = 0, ban_reason = NULL, ban_expires = NULL WHERE id = ?",
        userId
      );
    },
    async revokeSessions(userId) {
      calls.push({ op: "revokeSessions", userId });
      const result = await run("DELETE FROM session WHERE user_id = ?", userId);
      return result.meta.changes;
    },
    async deleteUser(userId) {
      calls.push({ op: "deleteUser", userId });
      await run("DELETE FROM user WHERE id = ?", userId);
    },
    async sendPasswordReset(email, redirectTo) {
      if (options.failPasswordReset) throw options.failPasswordReset;
      calls.push({ op: "sendPasswordReset", email, redirectTo });
    },
    async startImpersonation(userId) {
      calls.push({ op: "startImpersonation", userId });
    },
    async stopImpersonation() {
      calls.push({ op: "stopImpersonation" });
    },
  };
}
