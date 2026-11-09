import { expect, test } from "./fixtures";

// A server-rendered island shows its buttons before React can handle them. On a slow
// connection a person who clicks right away used to lose the click: the button looked
// ready but nothing happened. Inside an island (hydrationGated) the buttons are
// disabled and busy until React has hydrated, so the click waits for a working button
// and takes effect. Here Astro's React renderer is held back, so hydration cannot start
// until the test lets it, and the click is sent before that.
test("a click before the island hydrates waits for it and takes effect", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  let release: () => void = () => {};
  const scriptsHeld = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Astro's React renderer: without it no island hydrates (dev, and a built chunk).
  await page.route(
    /@astrojs\/react\/client|\/_astro\/client\.[\w-]+\.js/,
    async (route) => {
      await scriptsHeld;
      await route.continue();
    }
  );

  // "commit": the HTML parses while the renderer waits; DOMContentLoaded would wait for
  // the page's module scripts.
  await page.goto("/two-factor", { waitUntil: "commit" });
  const toggle = page.getByRole("button", { name: "Use a recovery code" });
  await expect(toggle).toBeVisible();
  // Server-rendered and not hydrated: visibly not ready, and the browser's own
  // implicit submission (Enter in the field) is blocked with the submit button.
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("astro-island[ssr]")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Verify", exact: true })
  ).toBeDisabled();

  // Click first, then let the scripts (and hydration) through.
  const click = toggle.click();
  release();
  await click;

  await expect(page.getByLabel("Recovery code")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use authenticator" })
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Use authenticator" })
  ).not.toHaveAttribute("aria-busy");
  expect(
    errors.filter((text) => /hydrat|did not match/i.test(text)),
    "hydration mismatches"
  ).toEqual([]);
});
