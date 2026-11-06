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
