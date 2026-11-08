import { expect, type Page, test } from "./fixtures";
import { open, sharedSession } from "./helpers";

// Moving around the signed-in app never reloads the document: every settings section and
// every sidebar entry routes client-side. A mark set on `window` once must still be there
// after each click (a full page load would drop it). test/architecture/spa-links.test.ts
// guards the source against plain /app anchors. No sign-up here.
test.use({ storageState: sharedSession });

type Marked = Window & { __spaMarker?: number };

async function expectNoReload(page: Page, step: string) {
  expect(
    await page.evaluate(() => (window as Marked).__spaMarker),
    `${step} reloaded the page`
  ).toBe(1);
}

test("settings sections and sidebar entries route client-side", async ({
  page,
}) => {
  await open(page, "/app/dashboard");
  await page.evaluate(() => {
    (window as Marked).__spaMarker = 1;
  });

  // Every section of the settings navigation, as the owner sees it.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Settings", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/settings\/account$/);
  const sections = page.getByRole("navigation", { name: "Settings" });
  await expect(
    sections.getByRole("link", { name: "Workspace", exact: true })
  ).toBeVisible();
  const labels = await sections.getByRole("link").allTextContents();
  expect(labels).toEqual(
    expect.arrayContaining(["Account", "Security", "Privacy", "Workspace"])
  );
  for (const label of labels) {
    await sections.getByRole("link", { name: label, exact: true }).click();
    await expect(
      sections.getByRole("link", { name: label, exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expectNoReload(page, `Settings › ${label}`);
  }

  // Every entry of the sidebar's main and product sections.
  for (const [label, path] of [
    ["Dashboard", /\/app\/dashboard$/],
    ["Trash", /\/app\/trash$/],
    ["Notes", /\/app\/notes$/],
    ["Tasks", /\/app\/tasks$/],
    ["Settings", /\/app\/settings\/account$/],
  ] as const) {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: label, exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(path);
    await expectNoReload(page, `Sidebar › ${label}`);
  }
});
