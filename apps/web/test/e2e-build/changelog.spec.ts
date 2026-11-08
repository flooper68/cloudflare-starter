/**
 * The release notes at /docs/changelog/ as built: rendered from CHANGELOG.md under the
 * prerendered page policy (any CSP violation fails, ../e2e/fixtures.ts), axe in both
 * themes, phone width, search, and the Atom feed.
 */

import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { CHANGELOG_PATH, parseChangelog } from "../../src/docs/changelog";
import { PRERENDERED_PAGE_CSP } from "../../src/server/security-headers";
import { expect, test } from "../e2e/fixtures";

const changelog = parseChangelog(
  readFileSync(
    new URL(`../../../../${CHANGELOG_PATH}`, import.meta.url),
    "utf8"
  )
);
const latest = changelog.releases.find((release) => release.date);

test("renders every release from CHANGELOG.md under the page policy", async ({
  page,
}) => {
  const response = await page.goto("/docs/changelog/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toBe(
    PRERENDERED_PAGE_CSP
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");
  for (const release of changelog.releases)
    await expect(
      page.getByRole("heading", { level: 2, name: release.version })
    ).toBeVisible();
  if (latest) {
    await expect(page.locator(`time[datetime="${latest.date}"]`)).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: latest.groups[0].type })
    ).toHaveCount(
      changelog.releases.filter((release) =>
        release.groups.some((group) => group.type === latest.groups[0].type)
      ).length
    );
  }
  await expect(
    page
      .getByRole("navigation", { name: "Docs", exact: true })
      .getByRole("link", {
        name: "Changelog",
      })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.locator('link[rel="alternate"][type="application/atom+xml"]')
  ).toHaveAttribute("href", "/docs/changelog.xml");
});

for (const colorScheme of ["dark", "light"] as const)
  test(`passes axe in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/docs/changelog/");
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`
      )
    ).toEqual([]);
  });

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("does not scroll sideways", async ({ page }) => {
    await page.goto("/docs/changelog/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("search finds the changelog", async ({ page }) => {
  await page.goto("/docs/");
  await page.getByRole("button", { name: "Search docs" }).click();
  await page.getByRole("combobox", { name: "Search docs" }).fill("changelog");
  await expect(
    page.getByRole("option").filter({ hasText: "Changelog" }).first()
  ).toBeVisible();
});

test("the Atom feed lists the released versions", async ({ request }) => {
  const response = await request.get("/docs/changelog.xml");
  expect(response.status()).toBe(200);
  // Served as a static asset: Workers Static Assets types .xml as application/xml.
  expect(response.headers()["content-type"]).toMatch(/xml/);
  const xml = await response.text();
  expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
  if (latest) expect(xml).toContain(`<title>${latest.version}</title>`);
  expect(xml).not.toContain("<title>Unreleased</title>");
});

test("the landing page links to the changelog", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Changelog" })
  ).toHaveAttribute("href", "/docs/changelog/");
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Changelog" })
  ).toHaveAttribute("href", "/docs/changelog/");
});
