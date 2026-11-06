/**
 * The public docs site: from the landing page into the docs, through the navigation to a
 * guide, with links rewritten for the site, the outline, the edit link and the theme
 * switch; unknown paths get the public 404. Signed out, no account needed.
 */
import { expect, test } from "@playwright/test";

test.describe("docs site", () => {
  test("landing → docs → a guide", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Docs", exact: true })
      .click();

    await expect(page).toHaveURL(/\/docs\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Docs");
    const nav = page.getByRole("navigation", { name: "Docs", exact: true });
    await expect(
      nav.getByRole("link", { name: "Overview", exact: true })
    ).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Set up the D1 database" }).click();
    await expect(page).toHaveURL(/\/docs\/guides\/how-to-setup-d1\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "How to set up the D1 database"
    );
    await expect(page).toHaveTitle(/How to set up the D1 database/);
    await expect(
      nav.getByRole("link", { name: "Set up the D1 database" })
    ).toHaveAttribute("aria-current", "page");

    // The outline links to the page's own headings.
    const outline = page.getByRole("navigation", { name: "On this page" });
    const firstEntry = outline.getByRole("link").first();
    const fragment = await firstEntry.getAttribute("href");
    expect(fragment).toMatch(/^#.+/);
    await expect(page.locator(fragment ?? "")).toBeVisible();

    // Links written for GitHub point at site pages or at GitHub.
    const main = page.getByRole("main");
    const hrefs = await main
      .locator("a[href]")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    const relativeMd = hrefs.filter(
      (href) => href?.endsWith(".md") && !href.startsWith("https://")
    );
    expect(relativeMd).toEqual([]);
    expect(hrefs).toContain("/docs/guides/how-to-setup-web-app/");

    await expect(
      main.getByRole("link", { name: "Edit this page on GitHub" })
    ).toHaveAttribute(
      "href",
      "https://github.com/flooper68/cloudflare-starter/edit/main/docs/guides/how-to-setup-d1.md"
    );
  });

  test("the theme switch applies and remembers the other theme", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/docs/");
    await page
      .getByRole("button", { name: "Switch to the light theme" })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(
      page.getByRole("button", { name: "Switch to the dark theme" })
    ).toBeVisible();
  });

  test("an unknown page is the public 404", async ({ page }) => {
    const response = await page.goto("/docs/no-such-page/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "This page doesn't exist"
    );
    await expect(
      page.getByRole("link", { name: "Read the docs" })
    ).toHaveAttribute("href", "/docs/");
  });
});
