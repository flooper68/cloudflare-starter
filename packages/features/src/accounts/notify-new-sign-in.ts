import { and, eq, gt, ne } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock, Notify, RequestContext } from "../kernel";
import { session, user } from "./accounts.schema";
import { isNewSignIn, newSignInNotification } from "./domain";

/**
 * After a sign-in created `sessionId`: sends the `auth.new-sign-in` security notice when
 * the user has no other live session with the same user agent (isNewSignIn). Called from
 * the Better Auth session hook for password and social sign-ins, not for sign-up or email
 * verification, nor in the account's first minute (a Google sign-up signs in through the
 * callback). Returns whether it notified.
 */
export async function notifyNewSignIn(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly notify: Notify;
  },
  input: {
    readonly userId: string;
    readonly sessionId: string;
    readonly userAgent: string | null;
    readonly ip: string | null;
    readonly requestContext: RequestContext;
  }
): Promise<boolean> {
  const now = deps.clock.now();
  const [account] = await deps.db
    .select({ createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, input.userId));
  if (!account) return false;
  const otherSessions = await deps.db
    .select({ userAgent: session.userAgent, expiresAt: session.expiresAt })
    .from(session)
    .where(
      and(
        eq(session.userId, input.userId),
        ne(session.id, input.sessionId),
        gt(session.expiresAt, now)
      )
    )
    .limit(100);
  if (
    !isNewSignIn({
      userAgent: input.userAgent,
      otherSessions,
      accountCreatedAt: account.createdAt,
      now,
    })
  ) {
    return false;
  }
  await deps.notify(newSignInNotification, {
    recipients: [input.userId],
    data: {
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      ip: input.ip?.slice(0, 64) ?? null,
      signedInAt: now.toISOString(),
    },
    context: { workspaceId: null, requestContext: input.requestContext },
  });
  return true;
}
