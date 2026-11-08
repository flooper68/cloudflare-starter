/**
 * The architecture pages as built: each diagram (an SVG generated from Mermaid,
 * src/docs/mermaid-svg.ts) is inlined by the docs pipeline (src/docs/diagrams.ts) under
 * the prerendered page policy with zero CSP violations (the fixtures' guard), named for
 * screen readers, coloured by the theme, scrolling in its own box on a phone, and
 * passing axe in both themes.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "../e2e/fixtures";

/** Each architecture page and how many diagrams it shows. */
const PAGES = [
  ["/docs/architecture/overview/", 1],
  ["/docs/architecture/layers/", 1],
  ["/docs/architecture/request-lifecycles/", 6],
  ["/docs/architecture/data-model/", 1],
  ["/docs/architecture/cross-cutting/", 5],
  ["/docs/architecture/feature-anatomy/", 1],
] as const;

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`
  );
}

for (const [path, count] of PAGES)
  test(`${path} renders its diagrams as SVG`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const diagrams = page.locator("figure[data-docs-diagram] svg[role=img]");
    await expect(diagrams).toHaveCount(count);
    // No diagram left as a Mermaid code block; each SVG has its title and description.
    await expect(page.locator("pre code.language-mermaid")).toHaveCount(0);
    for (const svg of await diagrams.all()) {
      await expect(svg.locator(":scope > title")).not.toBeEmpty();
      await expect(svg.locator(":scope > desc")).not.toBeEmpty();
      // Its own size: wide diagrams scroll instead of shrinking their text.
      const { rendered, natural } = await svg.evaluate((element) => ({
        rendered: element.getBoundingClientRect().width,
        natural: Number(element.getAttribute("width")),
      }));
      expect(Math.round(rendered)).toBe(natural);
    }
  });

test("diagram colours follow the theme switch", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/docs/architecture/layers/");
  const text = page.locator("figure[data-docs-diagram] svg text").first();
  const fill = () => text.evaluate((element) => getComputedStyle(element).fill);
  const dark = await fill();
  await page.getByRole("button", { name: "Switch to the light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await fill()).not.toBe(dark);
});

for (const colorScheme of ["dark", "light"] as const)
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });
    for (const [path] of PAGES)
      test(`${path} passes axe`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });
  });

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("a wide diagram scrolls in its box, not the page", async ({ page }) => {
    await page.goto("/docs/architecture/overview/");
    const box = page.locator("figure[data-docs-diagram]").first();
    expect(
      await box.evaluate((element) => element.scrollWidth > element.clientWidth)
    ).toBe(true);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
