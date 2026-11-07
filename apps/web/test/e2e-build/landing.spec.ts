/**
 * The landing page as built: prerendered (the same HTML signed in or out), its links,
 * and the public pages at phone width without sideways scrolling.
 */
import { PRERENDERED_PAGE_CSP } from "../../src/server/security-headers";
import { expect, test } from "../e2e/fixtures";

test.describe("landing page", () => {
  test("is static HTML with the starter's links and no React", async ({
    page,
    request,
  }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe(
      "public, max-age=0, must-revalidate"
    );
    expect(response.headers()["content-security-policy"]).toBe(
      PRERENDERED_PAGE_CSP
    );
    const html = await response.text();
    expect(html).not.toContain("astro-island");

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The Cloudflare-first SaaS starter"
    );
    const header = page.getByRole("banner");
    await expect(
      header.getByRole("link", { name: "Open app" })
    ).toHaveAttribute("href", "/app/dashboard");
    await expect(header.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in"
    );
    const main = page.getByRole("main");
    await expect(
      main.getByRole("link", { name: "Read the docs" })
    ).toHaveAttribute("href", "/docs/");
    await expect(
      main.getByRole("link", { name: "View on GitHub" })
    ).toHaveAttribute(
      "href",
      "https://github.com/flooper68/cloudflare-starter"
    );
    await expect(
      main.getByRole("link", { name: "Open Storybook" })
    ).toHaveAttribute("href", "/_storybook/");
    await expect(
      page
        .getByRole("region", { name: "What's in the box" })
        .getByRole("listitem")
    ).toHaveCount(12);
  });

  test("Read the docs leads into the docs", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("main")
      .getByRole("link", { name: "Read the docs" })
      .click();
    await expect(page).toHaveURL(/\/docs\/$/);
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of ["/", "/docs/", "/docs/guides/how-to-setup-d1/", "/nope/"])
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
});
