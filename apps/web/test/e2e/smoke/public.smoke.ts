/**
 * Production smoke: what a signed-out visitor sees on a deployed app, checked with GET
 * requests only. Run with `bun run test:smoke -- --base-url https://starter.flooper.me`;
 * the deploy workflow runs it after every deploy. Features that need an account are in
 * the scripted checklist, docs/guides/how-to-qa-a-deployment.md.
 */
import AxeBuilder from "@axe-core/playwright";

import { expect, hydrated, test } from "./fixtures";

const smoke = { tag: "@smoke" };

test.describe("public pages", () => {
  test("landing page answers 200 with its content", smoke, async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(
      header.getByRole("link", { name: "Try the demo" })
    ).toHaveAttribute("href", "/sign-up");
    const main = page.getByRole("main");
    await expect(
      main.getByRole("link", { name: "Try the demo app" }).first()
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: "View on GitHub" }).first()
    ).toBeVisible();
    await expect(
      main.getByRole("img", { name: /One app in the middle/ })
    ).toBeVisible();
    await expect(
      main.getByRole("group", { name: "Feature map" })
    ).toBeVisible();
  });

  for (const { path, heading } of [
    { path: "/sign-in", heading: /sign in/i },
    { path: "/sign-up", heading: /create|sign up/i },
  ]) {
    test(
      `${path} renders its form and the Turnstile widget`,
      smoke,
      async ({ page }) => {
        const widgetScript = page.waitForRequest((request) =>
          request
            .url()
            .startsWith("https://challenges.cloudflare.com/turnstile/")
        );
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await hydrated(page);
        await expect(page).toHaveTitle(heading);
        await expect(page.getByLabel("Email")).toBeVisible();
        await expect(page.getByLabel("Password")).toBeVisible();
        // The HumanCheck container (packages/ui human-check.tsx) and the widget script it
        // loads; with TURNSTILE=off neither exists.
        await expect(
          page.getByRole("group", { name: "Human check" })
        ).toBeVisible();
        await widgetScript;
      }
    );
  }
});

test.describe("demo notice", () => {
  // DEMO_MODE of the environment named with `--env` (scripts/smoke.ts passes
  // SMOKE_DEMO_MODE from its vars in wrangler.jsonc): on, the sign-up page names the
  // retention and links the starter on GitHub before anyone signs up; off, no notice.
  // With a bare --base-url the setting is unknown and the test is skipped.
  test(
    "/sign-up shows the demo notice exactly when demo mode is on",
    smoke,
    async ({ page }) => {
      const demo = process.env.SMOKE_DEMO_MODE;
      test.skip(!demo, "demo mode unknown without --env");
      await page.goto("/sign-up");
      await hydrated(page);
      const notice = page.getByRole("status", { name: "Demo instance" });
      if (demo === "on") {
        await expect(notice).toContainText(
          /Demo instance: your account and data are deleted after \d+ days\./
        );
        await expect(
          notice.getByRole("link", { name: /Get the starter on GitHub/ })
        ).toHaveAttribute("href", /^https:\/\/github\.com\//);
      } else {
        await expect(notice).toHaveCount(0);
      }
    }
  );
});

test.describe("signed-out access", () => {
  for (const path of ["/app", "/app/dashboard"]) {
    test(`${path} redirects to sign-in`, smoke, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBeGreaterThanOrEqual(300);
      expect(response.status()).toBeLessThan(400);
      expect(
        new URL(response.headers().location ?? "", response.url()).pathname
      ).toBe("/sign-in");
    });
  }

  test("/admin is a 404 when signed out", smoke, async ({ request }) => {
    const response = await request.get("/admin", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });
});

test.describe("HTTP endpoints", () => {
  test("/_storybook/ answers 200", smoke, async ({ request }) => {
    const response = await request.get("/_storybook/");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/html");
  });

  test("/api/hello answers 200", smoke, async ({ request }) => {
    const response = await request.get("/api/hello");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ message: "hello world" });
  });

  // Health endpoints arrive with the health PR (#35); until it is deployed they are 404.
  test("/health/live passes", smoke, async ({ request }) => {
    const response = await request.get("/health/live");
    test.skip(
      response.status() === 404,
      "/health/live is 404: the health endpoints (PR #35) are not deployed yet"
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: "pass" });
  });

  test("/health/ready passes or warns", smoke, async ({ request }) => {
    const response = await request.get("/health/ready");
    test.skip(
      response.status() === 404,
      "/health/ready is 404: the health endpoints (PR #35) are not deployed yet"
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).status).toMatch(/^(pass|warn)$/);
  });
});

/**
 * Security headers on the landing page. A row with `pending` names the PR that adds the
 * header; it is `test.fixme` until that PR is deployed, then drop `pending`.
 */
const securityHeaders: readonly {
  readonly name: string;
  readonly expected: RegExp;
  readonly pending?: string;
}[] = [
  // TODO(security-headers PR, not yet opened): drop `pending` once it is deployed.
  {
    name: "strict-transport-security",
    expected: /max-age=\d{7,}/,
    pending: "security-headers PR",
  },
  {
    name: "x-content-type-options",
    expected: /^nosniff$/,
    pending: "security-headers PR",
  },
  {
    name: "referrer-policy",
    expected: /strict-origin-when-cross-origin|no-referrer/,
    pending: "security-headers PR",
  },
  {
    name: "content-security-policy",
    expected: /frame-ancestors/,
    pending: "security-headers PR",
  },
  {
    name: "permissions-policy",
    expected: /camera=\(\)/,
    pending: "security-headers PR",
  },
  {
    name: "cross-origin-opener-policy",
    expected: /same-origin/,
    pending: "security-headers PR",
  },
];

test.describe("security headers", () => {
  for (const header of securityHeaders) {
    const title = `${header.name} is set`;
    if (header.pending) {
      test.fixme(`${title} (pending: ${header.pending})`, smoke, () => {});
      continue;
    }
    test(title, smoke, async ({ request }) => {
      const response = await request.get("/");
      expect(response.headers()[header.name] ?? "").toMatch(header.expected);
    });
  }
});

/**
 * Cloudflare's edge can inject its Web Analytics beacon into every HTML page of a zone
 * ("automatic setup", shared with the owner's other sites). Every HTML response says
 * `Cache-Control: no-transform` so it does not
 * (docs/guides/how-to-configure-security-headers.md#edge-injected-web-analytics). With
 * WEB_ANALYTICS=none a page's HTML must hold no beacon at all; with cloudflare, only the
 * app's own one. Which is set is read from /sign-in's policy, rendered per request: it
 * allows the beacon only with WEB_ANALYTICS=cloudflare (the prerendered pages always do,
 * so there only this HTML check, not the CSP guard, catches an injected beacon). Under
 * CSP_MODE=report-only the policy is in the report-only header.
 */
const BEACON_SCRIPT = /<script\b[^>]*\bsrc=["']?[^"'\s>]*cloudflareinsights/gi;

test.describe("edge-injected Web Analytics", () => {
  for (const path of [
    "/",
    "/docs/",
    "/docs/changelog/",
    "/no-such-page",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
  ]) {
    test(
      `${path} carries no beacon the app did not add`,
      smoke,
      async ({ page, request }) => {
        const signIn = await request.get("/sign-in");
        const webAnalytics =
          /script-src[^;]*static\.cloudflareinsights\.com/.test(
            signIn.headers()["content-security-policy-report-only"] ??
              signIn.headers()["content-security-policy"] ??
              ""
          );

        // The raw HTML, fetched with the browser's user agent (the edge injects only for
        // browsers). A 404 is not opened in the page: Chromium logs every 404 document
        // as a console error, which the fixture would count.
        const notFound = path === "/no-such-page";
        const response = await request.get(path, {
          headers: { accept: "text/html" },
        });
        expect(response.status()).toBe(notFound ? 404 : 200);
        expect(response.headers()["cache-control"] ?? "").toContain(
          "no-transform"
        );
        const beacons = (await response.text()).match(BEACON_SCRIPT) ?? [];
        if (webAnalytics) {
          expect(beacons.length, "the app's beacon, once").toBeLessThanOrEqual(
            1
          );
        } else {
          expect(beacons, "WEB_ANALYTICS=none: no beacon in the HTML").toEqual(
            []
          );
        }
        if (notFound) return;
        // In the browser too, under the CSP guard: an injected beacon the policy blocks
        // fails the test as a violation.
        await page.goto(path);
        if (!webAnalytics) {
          await expect(
            page.locator('script[src*="cloudflareinsights"]')
          ).toHaveCount(0);
        }
      }
    );
  }
});

test.describe("docs", () => {
  test(
    "/docs/ renders the index with its navigation",
    smoke,
    async ({ page }) => {
      const response = await page.goto("/docs/");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "What do you want to do?"
      );
      await expect(
        page
          .getByRole("navigation", { name: "Docs", exact: true })
          .getByRole("link", { name: "Set up the D1 database" })
      ).toBeVisible();
    }
  );

  test(
    "/docs/changelog/ renders the release notes",
    smoke,
    async ({ page }) => {
      const response = await page.goto("/docs/changelog/");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Changelog"
      );
      await expect(
        page.getByRole("heading", { level: 2, name: "Unreleased" })
      ).toBeVisible();
      await expect(page.locator("time[datetime]").first()).toBeVisible();
    }
  );

  test("search finds a page", smoke, async ({ page }) => {
    await page.goto("/docs/");
    await page.getByRole("button", { name: "Search docs" }).click();
    await page.getByRole("combobox", { name: "Search docs" }).fill("workspace");
    await expect(
      page.getByRole("listbox", { name: "Results" }).getByRole("option").first()
    ).toBeVisible();
  });

  test("robots.txt answers with crawler rules", smoke, async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toMatch(/^User-agent: \*/);
    // `--env <name>` (scripts/smoke.ts) says which rules to expect: only production
    // lets crawlers in (src/pages/robots.txt.ts). With a bare --base-url, either.
    if (process.env.SMOKE_ENV === "production") {
      expect(body).toContain("Disallow: /app\n");
      expect(body).not.toMatch(/^Disallow: \/$/m);
    } else if (process.env.SMOKE_ENV) {
      expect(body).toMatch(/^Disallow: \/$/m);
    }
  });
});

test.describe("accessibility", () => {
  for (const colorScheme of ["dark", "light"] as const) {
    for (const path of [
      "/",
      "/docs/",
      "/docs/changelog/",
      "/sign-in",
      "/sign-up",
      "/forgot-password",
    ]) {
      test(
        `${path} passes axe in the ${colorScheme} theme`,
        smoke,
        async ({ page }) => {
          await page.emulateMedia({ colorScheme });
          const response = await page.goto(path);
          expect(response?.status()).toBe(200);
          await hydrated(page);
          const results = await new AxeBuilder({ page })
            // Turnstile's cross-origin iframe is Cloudflare's markup, not the app's.
            .exclude('iframe[src^="https://challenges.cloudflare.com"]')
            .analyze();
          expect(
            results.violations.map(
              (violation) =>
                `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`
            )
          ).toEqual([]);
        }
      );
    }
  }
});
