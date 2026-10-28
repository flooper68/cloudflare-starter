/** Another session of the same user, as the new-sign-in rule sees it. */
export interface OtherSession {
  readonly userAgent: string | null;
  readonly expiresAt: Date;
}

/** A sign-in this soon after the account was created is its sign-up (Google), not news. */
export const NEW_ACCOUNT_GRACE_MS = 60_000;

/**
 * A sign-in is "new" when the user has no other live session with the same user agent:
 * the first sign-in from a browser or device, or the first after every session there
 * expired. Sessions without a user agent never match. The first minute of an account
 * does not count: a social sign-up opens its first session through the sign-in callback.
 */
export function isNewSignIn(input: {
  readonly userAgent: string | null;
  readonly otherSessions: readonly OtherSession[];
  readonly accountCreatedAt: Date;
  readonly now: Date;
}): boolean {
  if (
    input.now.getTime() - input.accountCreatedAt.getTime() <
    NEW_ACCOUNT_GRACE_MS
  ) {
    return false;
  }
  if (!input.userAgent) return true;
  return !input.otherSessions.some(
    (session) =>
      session.userAgent === input.userAgent &&
      session.expiresAt.getTime() > input.now.getTime()
  );
}
