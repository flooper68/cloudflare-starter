import { expect, takeCspViolations, test } from "../e2e/fixtures";
import { open } from "../e2e/helpers";

// The built app (playwright.build.config.ts): Astro's hashes, the page policy, the static
// assets' public/_headers and Storybook's own policy, in Chromium. Every test also fails
// on any CSP violation (the guard in ../e2e/fixtures.ts).

const PAGES = ["/", "/sign-in", "/sign-up", "/forgot-password"];

for (const path of PAGES) {
  test(`${path} renders under the enforced page policy`, async ({ page }) => {
    const response = await page.request.get(path);
    const policy = response.headers()["content-security-policy"] ?? "";
    expect(policy).toMatch(/script-src \S+\/_astro\/ 'sha256-/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("unsafe-inline");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    await open(page, path);
  });
}

test("the Turnstile widget renders on sign-up without a violation", async ({
  page,
}) => {
  await open(page, "/sign-up");
  await expect(page.getByRole("group", { name: "Human check" })).toBeVisible();
  await expect(page.getByText("Verified (local test)")).toBeVisible();
});

test("an injected inline script is blocked and reported", async ({ page }) => {
  await open(page, "/sign-in");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.__injected = true;";
    document.body.append(script);
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
