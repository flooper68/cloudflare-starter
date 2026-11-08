import { createVerifiedAccount } from "./support/accounts";
import { tinyPng } from "./support/files";
import { displayName, open } from "./support/session";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/test";

// Checklist: Trash (delete, restore, purge). One account, the owner of its workspace.
// "A member cannot delete forever" needs a second account and is covered by the API
// tests (apps/web/test/api/trash.test.ts), not here, to keep the run's sign-ups low.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let name: string;
let href: string;
const filename = `qa-trash-${process.env.QA_RUN_ID ?? "run"}.png`;
const png = tinyPng(5);

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  await createVerifiedAccount(page, { role: "trash" });
  name = await displayName(page);
});

test.afterAll(async () => {
  await page?.context().close();
});

const files = () => page.getByRole("list", { name: "Workspace files" });

test("a deleted file leaves the list and shows in the trash with who deleted it", async () => {
  await open(page, "/app/upload-demo");
  await page.locator("#binding-upload-file").setInputFiles({
    name: filename,
    mimeType: "image/png",
    buffer: png,
  });
  await expect(files().getByRole("link", { name: filename })).toBeVisible();
  href =
    (await files()
      .getByRole("link", { name: filename })
      .getAttribute("href")) ?? "";
  await files()
    .getByRole("button", { name: `Move to trash ${filename}` })
    .click();
  await expect(files().getByRole("link", { name: filename })).toHaveCount(0);

  await open(page, "/app/trash");
  await expect(
    page.getByRole("heading", { name: "Trash", exact: true })
  ).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: filename });
  await expect(row).toBeVisible();
  await expect(row).toContainText(name);
});

test("restoring brings it back to the list, and it downloads", async () => {
  await page.getByRole("button", { name: `Restore ${filename}` }).click();
  await expect(page.getByText(`Restored ${filename}`).first()).toBeVisible();
  await open(page, "/app/upload-demo");
  await expect(files().getByRole("link", { name: filename })).toBeVisible();
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(Buffer.from(await response.body()).equals(png)).toBe(true);
});

test("delete forever removes it, and its link answers 404", async () => {
  await files()
    .getByRole("button", { name: `Move to trash ${filename}` })
    .click();
  await expect(files().getByRole("link", { name: filename })).toHaveCount(0);
  await open(page, "/app/trash");
  await page
    .getByRole("button", { name: `Delete permanently ${filename}` })
    .click();
  await page
    .getByRole("alertdialog", { name: `Delete ${filename} permanently?` })
    .getByRole("button", { name: "Delete permanently" })
    .click();
  await expect(page.getByText(`Deleted ${filename} permanently`)).toBeVisible();
  await expect(page.getByRole("cell", { name: filename })).toHaveCount(0);
  expect((await page.request.get(href)).status()).toBe(404);
});
