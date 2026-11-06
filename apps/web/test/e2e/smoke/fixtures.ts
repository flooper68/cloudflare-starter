import { test as base, expect } from "@playwright/test";

/**
 * The production smoke suite's `test`: every page refuses to write to the deployed app and
 * fails on console errors.
 *
 * - Read-only by construction: a request to the app's own origin with any method other
 *   than GET, HEAD or OPTIONS is aborted before it leaves the browser, and the test fails.
 *   Cloudflare's RUM beacon (`/cdn-cgi/rum`) is answered locally with a 204 instead.
 *   The suite never signs up, signs in or submits a form (docs/guides/how-to-qa-a-deployment.md
 *   covers the features that need an account).
 * - Console errors and uncaught page errors fail the test. Turnstile's own iframe logs
 *   errors that the app cannot influence (its Private Access Token probe answers 401 by
 *   design), so messages from challenges.cloudflare.com are ignored.
 */
const THIRD_PARTY_NOISE = [/^https:\/\/challenges\.cloudflare\.com\//];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page, baseURL }, use) => {
      if (!baseURL) throw new Error("E2E_BASE_URL is not set");
      const origin = new URL(baseURL).origin;
      const errors: string[] = [];
      const writes: string[] = [];

      await page.route(
        (url) => url.origin === origin,
        (route) => {
          const method = route.request().method();
          if (["GET", "HEAD", "OPTIONS"].includes(method))
            return route.continue();
          // Cloudflare's own Real User Monitoring beacon (Web Analytics, injected at the
          // edge): answered here so the smoke run never counts as a visit.
          if (
            new URL(route.request().url()).pathname.startsWith("/cdn-cgi/rum")
          )
            return route.fulfill({ status: 204 });
          writes.push(`${method} ${route.request().url()}`);
          return route.abort("blockedbyclient");
        }
      );
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const source = message.location().url;
        if (THIRD_PARTY_NOISE.some((pattern) => pattern.test(source))) return;
        errors.push(`${message.text()}${source ? ` (${source})` : ""}`);
      });
      page.on("pageerror", (error) =>
        errors.push(`pageerror: ${error.message}`)
      );

      await use(errors);

      expect(
        writes,
        "the smoke suite must not write to the deployed app"
      ).toEqual([]);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Waits until the page's React islands have hydrated (Astro drops `ssr` then). */
export async function hydrated(page: import("@playwright/test").Page) {
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}
