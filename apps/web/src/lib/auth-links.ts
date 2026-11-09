/**
 * Pure helpers for the auth pages, safe on the server and in the browser.
 *
 * Messages for the error codes the server sets on purpose. A Google sign-up refused by
 * the sign-up policy comes back as `/sign-in?error=SIGN_UP_INVITE_ONLY`.
 */
/** A sign-up refused because the app's workspace (single mode) has no free seat. */
export const SIGN_UP_SEATS_FULL_MESSAGE =
  "This workspace has no free seats. Ask its owner to invite you or to add seats.";

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  SIGN_UP_INVITE_ONLY:
    "Sign-up is by invitation only. Ask someone in the workspace to invite you, then open the link in their email.",
  LIMIT_REACHED: SIGN_UP_SEATS_FULL_MESSAGE,
};

/** The message for one of our error codes (`?error=` or an API error's `code`), else null. */
export function authErrorForCode(
  code: string | null | undefined
): string | null {
  return code ? (AUTH_ERROR_MESSAGES[code] ?? null) : null;
}

const SAME_SITE = "http://same-site.invalid";

/**
 * A same-origin path from the page's `?next=` (the invitation link the user came from),
 * or null. The value is parsed the way a browser would (which drops tabs and newlines),
 * and only a result on this site is kept, so `//host`, `/\thost` or `https:` cannot
 * send the user elsewhere.
 */
export function nextPath(search: string): string | null {
  const next = new URLSearchParams(search).get("next");
  if (!next?.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(next, SAME_SITE);
  } catch {
    return null;
  }
  if (url.origin !== SAME_SITE) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Where a verification link lands: `/email-verified`, keeping a same-site `next`. */
export function verifiedCallbackURL(next: string | null): string {
  const safe = next ? nextPath(`?next=${encodeURIComponent(next)}`) : null;
  return safe
    ? `/email-verified?next=${encodeURIComponent(safe)}`
    : "/email-verified";
}

/**
 * Whether `/email-verified` was reached through a link that did not work: Better Auth
 * appends `?error=` (TOKEN_EXPIRED, INVALID_TOKEN, USER_NOT_FOUND, INVALID_USER).
 */
export function verificationFailed(search: string): boolean {
  return new URLSearchParams(search).has("error");
}

/**
 * Why a sign-up attempt failed, for the `auth.sign_up_failed` site event: a category,
 * never the message or the address.
 */
export function signUpFailureReason(error: {
  readonly status?: number;
  readonly code?: string;
}): "bot_check" | "exists" | "not_allowed" | "rate_limited" | "error" {
  const code = error.code ?? "";
  if (error.status === 429) return "rate_limited";
  if (code.startsWith("HUMAN_CHECK")) return "bot_check";
  if (code.startsWith("USER_ALREADY_EXISTS")) return "exists";
  if (code.startsWith("SIGN_UP_") || code === "LIMIT_REACHED")
    return "not_allowed";
  return "error";
}
