import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  NON_HTML_CSP,
  PRERENDERED_PAGE_CSP,
  STORYBOOK_CSP,
} from "../../src/server/security-headers";
import { expect, type Page, takeCspViolations, test } from "../e2e/fixtures";
import { newAccount } from "../e2e/helpers";
import {
  parseHeaders,
  securityHeaderProblems,
  servedPath,
} from "../static-headers-model";

// The built app (playwright.build.config.ts): Astro's hashes, the page policy, the static
// assets' public/_headers and Storybook's own policy, in Chromium. Every test also fails
// on any CSP violation in any page or frame (the guard in ../e2e/fixtures.ts).
//
// Unlike the dev journeys, this loads Cloudflare's real Turnstile widget with its
// always-pass test keys (TURNSTILE_SITE_KEY in wrangler.jsonc, the secret in
// .dev.vars.example), so the script-src and frame-src allowances meet the real api.js and
// its iframe. That needs the network to challenges.cloudflare.com, never an account.

/** Opens a page and waits for its React islands to hydrate. */
async function visit(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

// Pages rendered per request; the prerendered ones (/, /docs) are in docs.spec.ts and
// landing.spec.ts under PRERENDERED_PAGE_CSP.
const PAGES = ["/sign-in", "/sign-up", "/forgot-password"];

for (const path of PAGES) {
  test(`${path} renders under the enforced page policy`, async ({ page }) => {
    const response = await page.request.get(path);
    const policy = response.headers()["content-security-policy"] ?? "";
    expect(policy).toMatch(/script-src \S+\/_astro\/ 'sha256-/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    await visit(page, path);
  });
}

test("a signed-up user's journey: the real Turnstile widget, a dialog, a select, a profile save and a passkey", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const device = await context.newCDPSession(page);
  await device.send("WebAuthn.enable");
  await device.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  try {
    const account = newAccount("csp-build");
    await visit(page, "/sign-up");
    // The widget's challenge iframe (in a shadow root) loaded from Cloudflare.
    await expect
      .poll(
        () =>
          page
            .frames()
            .some((frame) =>
              frame.url().startsWith("https://challenges.cloudflare.com/")
            ),
        { timeout: 20_000 }
      )
      .toBe(true);
    await page.getByLabel("Name").fill(account.name);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    const submit = page.getByRole("button", { name: "Create account" });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);

    // A modal dialog: Radix locks scrolling with a <style> computed at runtime.
    await page.getByRole("button", { name: /workspace menu/ }).click();
    await page.getByRole("menuitem", { name: "Create workspace" }).click();
    const create = page.getByRole("dialog", { name: "Create workspace" });
    await expect(create).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(create).toHaveCount(0);

    // A Radix Select, then a profile save.
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("link", { name: "Appearance & language" }).click();
    await page.getByRole("combobox", { name: "Theme" }).click();
    await expect(page.getByRole("option", { name: "Dark" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Account" }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      account.name
    );
    await page.getByLabel("Name", { exact: true }).fill("CSP build user");
    // Saving reloads the page; sonner's injected stylesheet is on every page anyway.
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "CSP build user"
    );

    // A passkey ceremony (WebAuthn through the virtual authenticator).
    await page.getByRole("link", { name: "Security" }).click();
    await page
      .getByLabel("Password for security changes")
      .fill(account.password);
    await page.getByLabel("Passkey name").fill("Build laptop");
    await page
      .getByRole("button", { name: "Add passkey", exact: true })
      .click();
    await expect(page.getByText("Build laptop", { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("an injected inline script is blocked and reported", async ({ page }) => {
  await visit(page, "/sign-in");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.__injected = true;";
    document.body.appendChild(script);
  });
  await expect
    .poll(() => takeCspViolations().map((v) => v.directive))
    .toContain("script-src-elem");
  expect(await page.evaluate(() => "__injected" in window)).toBe(false);
});

test("the app cannot be framed by another origin", async ({ page }) => {
  await page.goto("about:blank");
  await page.setContent(
    `<iframe src="${new URL("/sign-in", test.info().project.use.baseURL).href}"></iframe>`
  );
  // Chromium replaces a refused frame with its error page.
  await expect
    .poll(() => page.frames()[1]?.url() ?? "")
    .toMatch(/^chrome-error:/);
  await expect(
    page.frameLocator("iframe").getByRole("button", { name: "Sign in" })
  ).toHaveCount(0);
  // A refusal may be reported as a frame-ancestors violation; it is the expected one.
  for (const violation of takeCspViolations()) {
    expect(violation.directive).toBe("frame-ancestors");
  }
});

test("Storybook renders under its own policy", async ({ page }) => {
  const response = await page.request.get("/_storybook/");
  expect(response.ok()).toBe(true);
  const policy = response.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("frame-ancestors 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  await page.goto("/_storybook/?path=/story/actions-button--playground");
  const preview = page.frameLocator("#storybook-preview-iframe");
  await expect(preview.getByRole("button").first()).toBeVisible();
});

test("static assets, API and health answers carry the headers", async ({
  request,
}) => {
  for (const path of ["/favicon.svg", "/api/hello", "/health/live"]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    const headers = response.headers();
    expect(headers["content-security-policy"], path).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["cross-origin-resource-policy"], path).toBe("same-origin");
    expect(headers["referrer-policy"], path).toBe(
      "strict-origin-when-cross-origin"
    );
  }
});

// Cache-Control: no-transform on every HTML response, so a zone's Web Analytics
// "automatic setup" injects no beacon at the edge
// (docs/guides/how-to-configure-security-headers.md#edge-injected-web-analytics). The
// edge itself is not here: this proves what the Worker and public/_headers send.
test("every HTML response says no-transform; other responses keep their Cache-Control", async ({
  request,
}) => {
  const revalidate = "public, max-age=0, must-revalidate";
  const html: readonly (readonly [string, number, string])[] = [
    // Prerendered pages and Storybook (public/_headers): the assets' caching, plus no-transform.
    ["/", 200, `${revalidate}, no-transform`],
    ["/docs/", 200, `${revalidate}, no-transform`],
    ["/docs/changelog/", 200, `${revalidate}, no-transform`],
    ["/no-such-page", 404, `${revalidate}, no-transform`],
    ["/_storybook/", 200, `${revalidate}, no-transform`],
    ["/_storybook/iframe", 200, `${revalidate}, no-transform`],
    // Rendered per request (the middleware): no-transform alone, never public.
    ["/sign-in", 200, "no-transform"],
    ["/forgot-password", 200, "no-transform"],
  ];
  for (const [path, status, cacheControl] of html) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    expect(response.headers()["content-type"], path).toContain("text/html");
    expect(response.headers()["cache-control"], path).toBe(cacheControl);
  }
  for (const [path, cacheControl] of [
    ["/docs/changelog.xml", revalidate],
    ["/favicon.svg", revalidate],
    ["/health/live", "no-store"],
  ] as const) {
    const response = await request.get(path);
    expect(response.headers()["cache-control"], path).toBe(cacheControl);
  }
  const redirect = await request.get("/app/dashboard", { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers()["cache-control"]).toBeUndefined();
});

// Every file of the build, through the built _headers (with the adapter's /_astro/* rule)
// as Cloudflare applies it in any rule order (test/static-headers-model.ts): exactly one
// policy each, and an HTML page never the asset one. `astro preview` applies the rules
// in file order only, which hid two policies on / in production.
test("every built file gets exactly one policy, whatever order the edge applies _headers in", () => {
  const clientURL = new URL("../../dist/client/", import.meta.url);
  const client = fileURLToPath(clientURL);
  const rules = parseHeaders(
    readFileSync(new URL("_headers", clientURL), "utf8")
  );
  // Workers Static Assets keeps one block per path: a second one (the adapter's
  // /_astro/* Cache-Control, say) would replace the first.
  const patterns = rules.map((rule) => rule.pattern);
  expect(patterns.length).toBe(new Set(patterns).size);
  const files = readdirSync(client, { recursive: true, withFileTypes: true })
    // _headers and .assetsignore configure the asset layer; they are not served.
    .filter(
      (entry) =>
        entry.isFile() && ![".assetsignore", "_headers"].includes(entry.name)
    )
    .map((entry) => relative(client, join(entry.parentPath, entry.name)));
  expect(files.length).toBeGreaterThan(100);
  const problems: string[] = [];
  for (const file of files) {
    const path = servedPath(file);
    const result = securityHeaderProblems(rules, path);
    problems.push(...result.problems);
    if (file.endsWith(".html")) {
      const expected = path.startsWith("/_storybook/")
        ? STORYBOOK_CSP
        : PRERENDERED_PAGE_CSP;
      if (result.csp !== expected)
        problems.push(`${path}: not its page policy`);
    } else if (!result.csp) {
      problems.push(`${path}: no policy`);
    }
  }
  expect(problems).toEqual([]);
  // Sanity: assets outside the policy groups get the policy that loads nothing.
  expect(securityHeaderProblems(rules, "/favicon.svg").csp).toBe(NON_HTML_CSP);
});
