import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { createWorkspace, open } from "./support/session";

// Checklist: Command palette. One account, an owner. The member's view (no workspace
// settings, no invite, no admin) is in workspaces.qa.ts, where a member exists; the
// admin's Admin entry needs the QA admin and is not repeated here.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
const title = `QA ${process.env.QA_RUN_ID ?? "run"} palette orbit`;
const palette = () => page.getByRole("dialog", { name: "Search and jump" });

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  await newQaAccount(page, { role: "palette" });
  await createWorkspace(page, `QA ${process.env.QA_RUN_ID ?? "run"} palette`);
});

test.afterAll(async () => {
  await page?.context().close();
});

test("⌘K opens it with the search focused and the Navigate, Workspaces and Actions groups", async () => {
  await open(page, "/app/dashboard");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette()).toBeVisible();
  await expect(palette().getByRole("combobox")).toBeFocused();
  for (const group of ["Navigate", "Workspaces", "Actions"]) {
    await expect(palette().getByRole("group", { name: group })).toBeVisible();
  }
  await page.keyboard.press("Escape");
});

test("part of a note's title finds it under Notes; Enter opens it", async () => {
  await open(page, "/app/notes");
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/app\/notes\/[0-9a-f-]{36}$/);
  const noteUrl = page.url();

  await open(page, "/app/dashboard");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("palette orbit");
  const notes = palette().getByRole("group", { name: "Notes" });
  await expect(
    notes.getByRole("option", { name: new RegExp(title) })
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(noteUrl);
});

test("Settings and Enter open the account settings; arrows, Home and End move the selection", async () => {
  await open(page, "/app/dashboard");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("Settings");
  const options = palette().getByRole("option");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  await expect(options.first()).toHaveText("Settings: Account");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/app\/settings\/account$/);
  await expect(
    page.getByRole("heading", { name: "Account settings" })
  ).toBeVisible();
});

test("the Search trigger opens it, Esc returns focus to it, and nonsense finds nothing", async () => {
  await open(page, "/app/dashboard");
  const trigger = page.getByRole("button", { name: "Search", exact: true });
  await trigger.click();
  await expect(palette()).toBeVisible();
  await page.keyboard.type("zzzz");
  await expect(palette().getByText(/^No results for .zzzz.$/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette()).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the theme action switches at once and is remembered after a reload", async () => {
  // The palette offers the theme the page is not in: switch to it, reload, switch back.
  const switchTheme = async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("theme");
    const option = palette().getByRole("option", {
      name: /^Switch to the (light|dark) theme$/,
    });
    const name = (await option.textContent()) ?? "";
    const theme = /light/.test(name) ? "light" : "dark";
    await option.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    return theme;
  };
  await open(page, "/app/dashboard");
  const first = await switchTheme();
  await open(page, "/app/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-theme", first);
  const second = await switchTheme();
  expect(second).not.toBe(first);
});

test("at phone width the trigger is an icon without a key hint and the palette fills the screen", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    await open(page, "/app/dashboard");
    const trigger = page.getByRole("button", { name: "Search", exact: true });
    await expect(trigger).toBeVisible();
    // The key hint is hidden at this width (it stays in the DOM).
    await expect(trigger.getByText(/⌘|Ctrl/)).toBeHidden();
    await trigger.click();
    const box = await palette().boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(380);
    await palette().getByRole("button", { name: "Cancel" }).click();
    await expect(palette()).toBeHidden();
  } finally {
    await page.setViewportSize({ width: 1280, height: 720 });
  }
});
