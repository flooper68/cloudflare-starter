/**
 * Pure helpers for the auth pages, safe on the server and in the browser.
 *
 * Messages for the error codes the server sets on purpose. A Google sign-up refused by
 * the sign-up policy comes back as `/sign-in?error=SIGN_UP_INVITE_ONLY`.
 */
const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  SIGN_UP_INVITE_ONLY:
    "Sign-up is by invitation only. Ask someone in the workspace to invite you, then open the link in their email.",
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
