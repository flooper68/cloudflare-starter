/**
 * Analytics under the built app's real policies (`_headers` and Astro's <meta> on the
 * prerendered pages, the per-request page policy elsewhere): the Cloudflare Web Analytics
 * beacon runs on the landing page and reports to its endpoint with no CSP violation, any
 * other script of its origin stays blocked, and pages rendered per request allow it only
 * with WEB_ANALYTICS=cloudflare. The site's own events go to /api/site-events with
 * sendBeacon. The beacon is served locally (page.route): nothing reaches Cloudflare.
 */
import {
  WEB_ANALYTICS_REPORT,
  WEB_ANALYTICS_SCRIPT,
} from "../../src/server/security-headers";
import { expect, type Page, takeCspViolations, test } from "../e2e/fixtures";

/** A stand-in beacon: reports one page view where the real one does. */
const BEACON = `fetch(${JSON.stringify(WEB_ANALYTICS_REPORT)}, { method: "POST", body: "{}", keepalive: true, mode: "no-cors" });`;

async function serveBeacon(page: Page): Promise<string[]> {
  const reported: string[] = [];
  await page.route(`${WEB_ANALYTICS_SCRIPT}*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: BEACON,
    })
  );
  await page.route("https://static.cloudflareinsights.com/other.js", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" })
  );
  await page.route(`${WEB_ANALYTICS_REPORT}*`, (route) => {
    reported.push(route.request().url());
    return route.fulfill({ status: 204 });
  });
  return reported;
}

/** Adds a script tag the way WebAnalytics.astro renders the beacon. */
function addScript(page: Page, src: string) {
  return page.evaluate((source) => {
    const script = document.createElement("script");
    script.src = source;
    script.defer = true;
    script.dataset.cfBeacon = JSON.stringify({ token: "e2e", spa: false });
    document.body.appendChild(script);
  }, src);
}

test.describe("Web Analytics beacon", () => {
  for (const path of ["/", "/docs/"]) {
    test(`runs and reports on the prerendered ${path} without a CSP violation`, async ({
      page,
    }) => {
      const reported = await serveBeacon(page);
      await page.goto(path);
      await addScript(page, WEB_ANALYTICS_SCRIPT);
      await expect.poll(() => reported.length).toBe(1);
      // The fixture fails the test on any violation; there must be none.
      expect(takeCspViolations()).toEqual([]);
    });
  }

  test("is exactly the beacon: another script of its origin stays blocked", async ({
    page,
  }) => {
    await serveBeacon(page);
    await page.goto("/");
    await addScript(page, "https://static.cloudflareinsights.com/other.js");
    await expect
      .poll(() => takeCspViolations().map((violation) => violation.blocked))
      .toContainEqual(
        expect.stringContaining("static.cloudflareinsights.com/other.js")
      );
  });

  test("is not allowed on a page rendered per request with WEB_ANALYTICS=none", async ({
    page,
  }) => {
    const reported = await serveBeacon(page);
    await page.goto("/sign-in");
    await addScript(page, WEB_ANALYTICS_SCRIPT);
    await expect
      .poll(() => takeCspViolations().map((violation) => violation.blocked))
      .toContainEqual(expect.stringContaining("static.cloudflareinsights.com"));
    expect(reported).toEqual([]);
  });
});

test.describe("site events", () => {
  test("the landing page sends its view and a call to action with sendBeacon", async ({
    page,
  }) => {
    // Automated browsers send nothing (navigator.webdriver); this one pretends not to be.
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "webdriver", { get: () => false })
    );
    const batches: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/site-events")
        batches.push(request.postData() ?? "");
    });
    await page.goto("/");
    await expect
      .poll(() => batches.join("\n"))
      .toContain('"event":"site.page_viewed"');
    expect(batches.join("\n")).toContain('"page":"home"');

    await page.getByRole("button", { name: "Copy prompt" }).click();
    await expect
      .poll(() => batches.join("\n"))
      .toContain('"cta":"copy_prompt"');
    // Nothing in a batch names the visitor.
    expect(batches.join("\n")).not.toMatch(/cookie|email|session/i);
  });

  test("an automated browser sends nothing", async ({ page }) => {
    const batches: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/site-events")
        batches.push(request.postData() ?? "");
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Copy prompt" }).click();
    await page.waitForTimeout(1500);
    expect(batches).toEqual([]);
  });
});
