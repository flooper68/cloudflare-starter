/**
 * The theme switch works everywhere the public header appears, as built: the prerendered
 * pages and the account pages rendered per request, whose policy allows the one file
 * /site-theme.js. The choice carries across both kinds of page. Zero CSP violations
 * (fixtures.ts).
 */
import { expect, test } from "../e2e/fixtures";

test.use({ colorScheme: "dark" });

test("the account pages allow the theme script and nothing more", async ({
  request,
}) => {
  const response = await request.get("/sign-in");
  const policy = response.headers()["content-security-policy"] ?? "";
  const scriptSrc =
    policy
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("script-src ")) ?? "";
  expect(scriptSrc).toMatch(/ http:\/\/localhost:\d+\/site-theme\.js /);
  expect(scriptSrc).not.toMatch(/'self'|'unsafe-inline'/);
});

for (const path of ["/sign-in", "/sign-up", "/forgot-password"])
  test(`${path} switches the theme and keeps it`, async ({ page }) => {
    await page.goto(path);
    await page
      .getByRole("banner")
      .getByRole("button", { name: "Switch to the light theme" })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
