/**
 * The demo banner's dismissal (DEMO_MODE=on; docs/guides/how-to-run-a-public-demo.md):
 * kept in sessionStorage, so it holds for the browser session and the banner is back in
 * the next one. Storage may be unavailable (private mode, blocked): then the banner is
 * simply shown again. Starter-only, removed with demo mode.
 */

/** The starter's repository, the demo banner's "Get the starter on GitHub". */
export const STARTER_REPOSITORY_URL =
  "https://github.com/flooper68/cloudflare-starter";

export const DEMO_BANNER_DISMISSED_KEY = "demo-banner-dismissed";

type SessionStore = Pick<Storage, "getItem" | "setItem">;

function sessionStore(): SessionStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Whether the banner was dismissed in this browser session. */
export function demoBannerDismissed(
  store: SessionStore | null = sessionStore()
): boolean {
  try {
    return store?.getItem(DEMO_BANNER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers the dismissal for this browser session. */
export function dismissDemoBanner(
  store: SessionStore | null = sessionStore()
): void {
  try {
    store?.setItem(DEMO_BANNER_DISMISSED_KEY, "1");
  } catch {
    // Not remembered: the banner comes back on the next page load.
  }
}
