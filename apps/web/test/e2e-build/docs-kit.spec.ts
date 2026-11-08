/**
 * The visual docs as built: the docs home and three feature pages render with the
 * components kit (src/docs/kit/) under the prerendered page policy with zero CSP
 * violations (the fixtures' guard), pass axe in both themes, never scroll sideways on a
 * phone, show the screenshot for the theme, and the tabs work from the keyboard.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "../e2e/fixtures";

const PAGES = [
  "/docs/",
  "/docs/features/agents/",
  "/docs/features/workspaces/",
  "/docs/features/billing/",
];

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

    for (const path of PAGES)
      test(`${path} passes axe`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await violations(page)).toEqual([]);
      });

    test("a screenshot shows the image of the reader's theme", async ({
      page,
    }) => {
      await page.goto("/docs/features/workspaces/");
      const shot = page.locator(".dk-shot").first();
      await expect(
        shot.locator(`[data-variant="${colorScheme}"]`)
      ).toBeVisible();
      const other = colorScheme === "dark" ? "light" : "dark";
      await expect(shot.locator(`[data-variant="${other}"]`)).toBeHidden();
    });
  });
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of PAGES)
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Load every lazy image so the measurement includes them.
      await page.evaluate(async () => {
        for (const image of document.images) image.loading = "eager";
        await Promise.all(
          [...document.images].map((image) => image.decode().catch(() => {}))
        );
      });
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
});

test("tabbed code works from the keyboard", async ({ page }) => {
  await page.goto("/docs/features/agents/");
  const tabs = page.getByRole("tablist", { name: "Choose how" }).first();
  const first = tabs.getByRole("tab").first();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await first.focus();
  await page.keyboard.press("ArrowRight");
  const second = tabs.getByRole("tab").nth(1);
  await expect(second).toBeFocused();
  await expect(second).toHaveAttribute("aria-selected", "true");
  const panel = page.locator(`#${await second.getAttribute("aria-controls")}`);
  await expect(panel).toBeVisible();
  await page.keyboard.press("End");
  await expect(tabs.getByRole("tab").last()).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("the video slot shows a poster until the video exists", async ({
  page,
}) => {
  await page.goto("/docs/features/agents/");
  const video = page.locator(".dk-video").first();
  await expect(video).toContainText("Video coming soon");
  await expect(video.locator("video")).toHaveCount(0);
});
