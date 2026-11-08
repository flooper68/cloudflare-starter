import { mkdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";

import { expect, type Page, test } from "./fixtures";
import { open, sharedSession } from "./helpers";

// The app shell's command palette as the shared user (an owner): ⌘K / Ctrl+K and the
// top bar's Search open it; a note is found by part of its title and opened with Enter;
// "Settings" jumps to the settings; Escape returns focus to the trigger. The member's view
// (no workspace settings, no admin) is in workspaces.spec.ts, where a member exists.
// No sign-up here.
test.use({ storageState: sharedSession });

// COMMAND_PALETTE_EVIDENCE_DIR=<dir> also saves screenshots for a PR (both themes).
const evidence = process.env.COMMAND_PALETTE_EVIDENCE_DIR;

const palette = (page: Page) =>
  page.getByRole("dialog", { name: "Search and jump" });

async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {}))
    )
  );
}

/** axe finds nothing in the open palette, in the dark and the light theme. */
async function expectAccessibleInBothThemes(page: Page, name: string) {
  for (const theme of ["dark", "light"] as const) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await settle(page);
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations, `${name} (${theme})`).toEqual([]);
    if (evidence) {
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({
        animations: "disabled",
        path: join(evidence, `${name}-${theme}.png`),
      });
    }
  }
}

test("⌘K finds a note by part of its title and Enter opens it", async ({
  page,
}) => {
  const stamp = Date.now().toString(36);
  const title = `Palette orbit review ${stamp}`;

  await open(page, "/app/dashboard");

  // "New note" from the palette opens the form on the Notes page.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeVisible();
  await page.keyboard.type("new note");
  await expect(
    palette(page).getByRole("option", { name: "New note" })
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(palette(page)).toBeHidden();
  await expect(page).toHaveURL(/\/app\/notes$/);
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/app\/notes\/[0-9a-f-]{36}$/);
  const noteUrl = page.url();

  await open(page, "/app/dashboard");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type(`orbit review ${stamp}`);
  const notes = palette(page).getByRole("group", { name: "Notes" });
  await expect(
    notes.getByRole("option", { name: new RegExp(title) })
  ).toBeVisible();
  // The only match: selected, and its count announced.
  await expect(palette(page).getByRole("status")).toContainText("1 result");
  await expectAccessibleInBothThemes(page, "results");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(noteUrl);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

test("⌘K then Settings navigates; the palette lists owner pages and no admin", async ({
  page,
}) => {
  await open(page, "/app/dashboard");
  await page.keyboard.press("ControlOrMeta+k");
  await expectAccessibleInBothThemes(page, "empty");
  const navigate = palette(page).getByRole("group", { name: "Navigate" });
  await expect(navigate.getByRole("option", { name: "Tasks" })).toBeVisible();
  await expect(
    palette(page).getByRole("group", { name: "Actions" }).getByRole("option", {
      name: "Sign out",
    })
  ).toBeVisible();
  await expect(navigate.getByRole("option", { name: "Admin" })).toHaveCount(0);

  await page.keyboard.type("Settings");
  await expect(
    navigate.getByRole("option", { name: "Settings: Workspace" })
  ).toBeVisible();
  await expect(navigate.getByRole("option").first()).toHaveText(
    "Settings: Account"
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/settings\/account$/);
  await expect(palette(page)).toBeHidden();
});

test("the Search trigger opens it, Escape closes it and focus returns to the trigger; phones get it full screen", async ({
  page,
}) => {
  await open(page, "/app/dashboard");
  const trigger = page.getByRole("button", { name: "Search", exact: true });
  await trigger.click();
  await expect(palette(page)).toBeVisible();
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.keyboard.type("zzzz-nothing");
  await expect(palette(page).getByText(/No results for/)).toBeVisible();
  await expectAccessibleInBothThemes(page, "no-results");
  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
  await expect(trigger).toBeFocused();

  // The theme action switches at once, keeps focus on the trigger and is remembered.
  const html = page.locator("html");
  const before = await page.evaluate(
    () =>
      document.documentElement.dataset.theme ??
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
  );
  const after = before === "dark" ? "light" : "dark";
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type(`switch to the ${after} theme`);
  await page.keyboard.press("Enter");
  await expect(html).toHaveAttribute("data-theme", after);
  await expect(trigger).toBeFocused();
  await expect(async () => {
    await open(page, "/app/dashboard");
    await expect(html).toHaveAttribute("data-theme", after, { timeout: 1000 });
  }).toPass();
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type(`switch to the ${before} theme`);
  await page.keyboard.press("Enter");
  await expect(html).toHaveAttribute("data-theme", before);

  // Phone width: an icon trigger, a full-screen palette with Cancel.
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await settle(page);
  const box = await palette(page).boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: 390 });
  await page.keyboard.type("note");
  await expect(palette(page).getByText("Searching notes…")).toHaveCount(0);
  await expectAccessibleInBothThemes(page, "mobile");
  await palette(page).getByRole("button", { name: "Cancel" }).click();
  await expect(palette(page)).toBeHidden();
});
