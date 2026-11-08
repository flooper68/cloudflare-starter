/**
 * Docs search and page metadata on the build as deployed (astro build + astro preview,
 * `bun run build && bun run test:e2e:build`): the Pagefind index exists only in a build,
 * and every test also fails on any CSP violation (../e2e/fixtures.ts).
 */
import { expect, test } from "../e2e/fixtures";

test.describe("docs search", () => {
  test("⌘K opens the dialog, typing finds a guide, Enter opens it", async ({
    page,
  }) => {
    await page.goto("/docs/");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog", { name: "Search docs" });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole("combobox", { name: "Search docs" });
    await expect(input).toBeFocused();

    await input.fill("workspace mode");
    const results = dialog.getByRole("listbox", { name: "Results" });
    const first = results.getByRole("option").first();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute("aria-selected", "true");
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(
      results.getByRole("option", { name: /configure workspaces/i })
    ).toBeVisible();

    // Arrow keys move the selection; Enter opens the selected page.
    await input.press("ArrowDown");
    await expect(results.getByRole("option").nth(1)).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await input.press("ArrowUp");
    const url = await first.getAttribute("data-url");
    await input.press("Enter");
    await expect(page).toHaveURL(url ?? "");
  });

  test("the header button opens it; Escape closes it; no results says so", async ({
    page,
  }) => {
    await page.goto("/docs/guides/how-to-setup-d1/");
    await page.getByRole("button", { name: "Search docs" }).click();
    const dialog = page.getByRole("dialog", { name: "Search docs" });
    const input = dialog.getByRole("combobox");
    await input.fill("zzqxjv");
    await expect(dialog.getByRole("status")).toHaveText(/No results for/);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the 404 page offers search too", async ({ page }) => {
    const response = await page.goto("/docs/old-link/");
    expect(response?.status()).toBe(404);
    await page.getByRole("button", { name: "Search docs" }).click();
    await page.getByRole("combobox", { name: "Search docs" }).fill("trash");
    await expect(page.getByRole("option").first()).toBeVisible();
  });
});

test.describe("page metadata", () => {
  test("a guide has its title and first paragraph as description", async ({
    page,
  }) => {
    await page.goto("/docs/guides/how-to-setup-d1/");
    await expect(page).toHaveTitle(
      "How to set up the D1 database · Cloudflare Starter docs"
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /^The web app stores its data/
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /How to set up the D1 database/
    );
  });

  test("robots.txt of a non-production build disallows everything", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
  });
});
