import type { PlatformRole } from "../domain";

/**
 * The admin portal's way into the auth library, for every change that touches users,
 * sessions or cookies. Admin use cases read users, sessions and accounts from D1 directly
 * but never write those tables themselves: Better Auth owns them, caches sessions in
 * cookies, and runs its hooks (account deletion, audit) on its own writes.
 *
 * Implemented over Better Auth in `apps/web/src/server/admin-auth-gateway.ts` (pinned to
 * its version); integration tests use `packages/features/test/memory-admin-auth-gateway.ts`.
 */
export interface AdminAuthGateway {
  /** Sets the user's platform role. */
  resetSecondFactor(userId: string): Promise<void>;
  setRole(userId: string, role: PlatformRole): Promise<void>;
  /** Suspends the user (refused at sign-in from now on) until `expiresAt`, or for good. */
  ban(
    userId: string,
    input: { readonly reason: string | null; readonly expiresAt: Date | null }
  ): Promise<void>;
  /** Lifts a suspension. */
  unban(userId: string): Promise<void>;
  /** Signs the user out everywhere; returns how many sessions were revoked. */
  revokeSessions(userId: string): Promise<number>;
  /** Deletes the user with their sessions and accounts (runs the auth library's hooks). */
  deleteUser(userId: string, operationId?: string): Promise<void>;
  /** Emails the user a password reset link that opens `redirectTo`. */
  sendPasswordReset(email: string, redirectTo: string): Promise<void>;
  /**
   * Swaps the current browser session for one as `userId`, keeping the admin's session
   * aside to return to. Only for a request with a browser session (cookies).
   */
  startImpersonation(userId: string): Promise<void>;
  /** Ends the current impersonation and restores the admin's session. */
  stopImpersonation(): Promise<void>;
}
