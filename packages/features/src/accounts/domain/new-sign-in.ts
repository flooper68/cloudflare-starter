/** Another session of the same user, as the new-sign-in rule sees it. */
export interface OtherSession {
  readonly userAgent: string | null;
  readonly expiresAt: Date;
}

/**
 * A sign-in is "new" when the user has no other live session with the same user agent:
 * the first sign-in from a browser or device, or the first after every session there
 * expired. Sessions without a user agent never match.
 */
export function isNewSignIn(input: {
  readonly userAgent: string | null;
  readonly otherSessions: readonly OtherSession[];
  readonly now: Date;
}): boolean {
  if (!input.userAgent) return true;
  return !input.otherSessions.some(
    (session) =>
      session.userAgent === input.userAgent &&
      session.expiresAt.getTime() > input.now.getTime()
  );
}
