/**
 * axe (any violation fails) on the public pages as built, in the dark and the light
 * theme: the landing page, the docs index, a guide with code blocks and tables, a page
 * with inline diagrams, and the open search dialog with results.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "../e2e/fixtures";

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`
  );
}

for (const colorScheme of ["dark", "light"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const path of [
      "/",
      "/docs/",
      "/docs/guides/how-to-configure-workspaces/",
      "/docs/processes/agentic-workflow/",
      "/docs/roadmap/",
      // A walkthrough player from the docs kit's ::video{id="agents"}.
      "/docs/features/agents/",
    ])
      test(`${path} passes axe`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

    test("the open search dialog passes axe", async ({ page }) => {
      await page.goto("/docs/");
      await page.getByRole("button", { name: "Search docs" }).click();
      await page.getByRole("combobox", { name: "Search docs" }).fill("billing");
      await expect(page.getByRole("option").first()).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}
