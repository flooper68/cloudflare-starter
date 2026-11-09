import { roadmap } from "../../src/content/features";
import { PRERENDERED_PAGE_CSP } from "../../src/server/security-headers";
import { expect, test } from "../e2e/fixtures";

// The prerendered docs pages as built: served as static assets with the PRERENDERED_PAGE_CSP
// rule of public/_headers plus Astro's <meta> policy, with zero CSP violations (the
// fixtures' guard), Shiki's colours applied and the theme switch working.

test("a docs page renders under the prerendered page policy", async ({
  page,
}) => {
  const path = "/docs/guides/how-to-setup-d1/";
  const response = await page.request.get(path);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-security-policy"]).toBe(
    PRERENDERED_PAGE_CSP
  );
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");

  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How to set up the D1 database"
  );
  // Shiki's inline colour variables are allowed: a keyword is not the plain text colour.
  const code = page.locator("pre.astro-code").first();
  const plain = await code.evaluate(
    (element) => getComputedStyle(element).color
  );
  const colours = await code
    .locator("span[style]")
    .evaluateAll((spans) => spans.map((span) => getComputedStyle(span).color));
  expect(colours.some((colour) => colour !== plain)).toBe(true);

  // The external theme script runs: the switch changes the theme.
  await page.getByRole("button", { name: "Switch to the light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("a diagram is inlined and follows the theme switch", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/docs/processes/agentic-workflow/");
  const diagram = page
    .getByRole("figure", { name: /^Roles:/ })
    .getByRole("img", { name: /^Roles:/ });
  await expect(diagram).toBeVisible();
  // Inline, not an <img>: its colours come from the site's tokens.
  await expect(page.locator("img[src*='.svg']")).toHaveCount(0);
  const title = diagram.locator("text.dg-t").first();
  const fill = () =>
    title.evaluate((element) => getComputedStyle(element).fill);
  const dark = await fill();

  await page.getByRole("button", { name: "Switch to the light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(fill).not.toBe(dark);
});

test("the roadmap lists the planned features in order, never as built", async ({
  page,
}) => {
  const response = await page.goto("/docs/roadmap/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toBe(
    PRERENDERED_PAGE_CSP
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Roadmap");
  const nav = page.getByRole("navigation", { name: "Docs", exact: true });
  await expect(nav.getByRole("link", { name: "Roadmap" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  const list = page.getByRole("list", { name: "Planned features, in order" });
  const items = list.locator(":scope > li");
  await expect(items).toHaveCount(roadmap().length);
  for (const [index, item] of roadmap().entries()) {
    const entry = items.nth(index);
    const heading = entry.getByRole("heading", { level: 2 });
    await expect(heading).toContainText(item.name);
    await expect(heading).toContainText("Planned");
    await expect(heading).toHaveAttribute("id", item.id);
    await expect(entry.getByRole("listitem")).toHaveCount(item.points.length);
  }
  await expect(page.getByText("Built", { exact: true })).toHaveCount(0);
});

test("an unknown path is the public 404 under the same policy", async ({
  page,
}) => {
  const response = await page.goto("/docs/old-link/");
  expect(response?.status()).toBe(404);
  expect(response?.headers()["content-security-policy"]).toBe(
    PRERENDERED_PAGE_CSP
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "This page doesn't exist"
  );
});
