import { mkdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";

import { expect, type Page, test } from "./fixtures";
import { open, openProfileMenu, sharedSession } from "./helpers";

// The sidebar's two menus as the shared user (owner of their workspace): the profile menu
// in the footer holds the account (name and email, own pages, help, sign out), the
// workspace menu at the top only workspace things. Both route client-side, work collapsed
// and in the mobile drawer, and pass axe in both themes. Also the browser tab's title and
// the New note form's focus. The admin's and the impersonated view are in
// impersonation.spec.ts. No sign-up here.
test.use({ storageState: sharedSession });

// PROFILE_MENU_EVIDENCE_DIR=<dir> also saves screenshots for a PR (both themes).
const evidence = process.env.PROFILE_MENU_EVIDENCE_DIR;

const PROFILE_ITEMS = [
  "Account settings",
  "Security",
  "Connected agents",
  "Notifications",
  "Appearance",
  "Component library",
  "Docs",
  "Sign out",
];

async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {}))
    )
  );
}

/** Marks the document; a full page load would drop the mark. */
async function markDocument(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __spaMarker?: string }).__spaMarker = "set";
  });
}

async function expectSameDocument(page: Page) {
  expect(
    await page.evaluate(
      () => (window as unknown as { __spaMarker?: string }).__spaMarker
    )
  ).toBe("set");
}

/** axe finds nothing in the open menu, in the dark and the light theme. */
async function expectMenuAccessible(page: Page, name: string) {
  for (const theme of ["dark", "light"] as const) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await settle(page);
    const results = await new AxeBuilder({ page })
      .include('[role="menu"]')
      .analyze();
    expect(results.violations, `${name} (${theme})`).toEqual([]);
    if (evidence) {
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({
        path: join(evidence, `${name}-${theme}.png`),
      });
    }
  }
}

const menuItems = (page: Page) => page.getByRole("menu").getByRole("menuitem");

test("the profile menu holds the account, the workspace menu only the workspace", async ({
  page,
}) => {
  await open(page, "/app/dashboard");
  const trigger = page.getByRole("button", { name: /profile menu$/ });
  await expect(trigger).toBeVisible();

  const menu = await openProfileMenu(page);
  await expect(menu).toContainText(/@example\.test/);
  await expect(menuItems(page)).toHaveText(PROFILE_ITEMS);
  // The owner of the workspace, not a platform admin: no admin portal.
  await expect(
    page.getByRole("menuitem", { name: "Admin portal" })
  ).toHaveCount(0);
  await expectMenuAccessible(page, "profile-menu-desktop");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const workspace = page.getByRole("button", { name: /workspace menu$/ });
  await workspace.click();
  await expect(
    page.getByRole("menuitem", { name: "Workspace settings" })
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Create workspace" })
  ).toBeVisible();
  for (const accountItem of [
    "Sign out",
    "Account settings",
    "Component library",
  ]) {
    await expect(page.getByRole("menuitem", { name: accountItem })).toHaveCount(
      0
    );
  }
  await expectMenuAccessible(page, "workspace-menu-desktop");
  await page.keyboard.press("Escape");
  await expect(workspace).toBeFocused();
});

test("the menus' app pages open client-side, with the page in the tab's title", async ({
  page,
}) => {
  await open(page, "/app/dashboard");
  await expect(page).toHaveTitle(/^Dashboard · /);
  await markDocument(page);

  await openProfileMenu(page);
  await page.getByRole("menuitem", { name: "Security" }).click();
  await expect(page).toHaveURL(/\/app\/settings\/security$/);
  await expect(page).toHaveTitle(/^Security · /);

  // Keyboard: Enter on a link item follows it.
  await page.getByRole("button", { name: /profile menu$/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "Account settings" })
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/settings\/account$/);
  await expect(page).toHaveTitle(/^Account settings · /);

  await page.getByRole("button", { name: /workspace menu$/ }).click();
  await page.getByRole("menuitem", { name: "Workspace settings" }).click();
  await expect(page).toHaveURL(/\/app\/settings\/workspace$/);
  await expect(page).toHaveTitle(/^Workspace settings · /);
  await expectSameDocument(page);

  // The component library opens in a new tab, the docs in this one.
  await openProfileMenu(page);
  await expect(
    page.getByRole("menuitem", { name: "Component library" })
  ).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("menuitem", { name: "Docs" })).toHaveAttribute(
    "href",
    "/docs/"
  );
  await page.keyboard.press("Escape");
});

test("collapsed, the profile menu is the avatar with the name in a tooltip", async ({
  page,
}) => {
  await open(page, "/app/dashboard");
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  const trigger = page.getByRole("button", { name: /profile menu$/ });
  await trigger.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await trigger.click();
  await expect(menuItems(page)).toHaveText(PROFILE_ITEMS);
  await expectMenuAccessible(page, "profile-menu-collapsed");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Expand sidebar" }).click();
});

test("on a phone, the profile menu works inside the drawer and closes it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/app/dashboard");
  await markDocument(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await drawer.getByRole("button", { name: /profile menu$/ }).click();
  await expect(menuItems(page)).toHaveText(PROFILE_ITEMS);
  await expectMenuAccessible(page, "profile-menu-mobile");
  await page.getByRole("menuitem", { name: "Connected agents" }).click();
  await expect(page).toHaveURL(/\/app\/settings\/connected-agents$/);
  await expect(drawer).toHaveCount(0);
  await expectSameDocument(page);
});

test("New note focuses the title, and a note's tab is titled by the note", async ({
  page,
}) => {
  await open(page, "/app/notes");
  await expect(page).toHaveTitle(/^Notes · /);
  await page.getByRole("button", { name: "New note" }).first().click();
  const title = page.getByLabel("Title", { exact: true });
  await expect(title).toBeFocused();
  await page.getByRole("button", { name: "Cancel" }).click();

  // From the command palette's New note as well.
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "Search and jump" });
  await page.keyboard.type("new note");
  await expect(
    palette.getByRole("option", { name: "New note" })
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await expect(title).toBeFocused();
  const name = `Tab title ${Date.now().toString(36)}`;
  await title.fill(name);
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/app\/notes\/[^/]+$/);
  await expect(page).toHaveTitle(new RegExp(`^${name} · `));
  // Leaving the note gives the tab back to the navigation title.
  await page.getByRole("link", { name: "All notes" }).click();
  await expect(page).toHaveTitle(/^Notes · /);
});
