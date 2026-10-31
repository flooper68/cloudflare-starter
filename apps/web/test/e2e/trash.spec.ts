import { expect, test } from "@playwright/test";

import { open, sharedSession } from "./helpers";

test.use({ storageState: sharedSession });

test("move a file to the trash, undo, then restore it from the trash and delete it permanently", async ({
  page,
}) => {
  const filename = `budget-${Date.now()}.txt`;

  await open(page, "/app/upload-demo");
  await page.locator("#binding-upload-file").setInputFiles({
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from("Q4 budget\n"),
  });
  const files = page.getByRole("list", { name: "Workspace files" });
  await expect(files.getByRole("link", { name: filename })).toBeVisible();

  // Move to trash, then undo from the toast: the file is back in the list.
  const moveToTrash = files.getByRole("button", {
    name: `Move to trash ${filename}`,
  });
  await moveToTrash.click();
  await expect(files.getByRole("link", { name: filename })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText(`Restored ${filename}`).first()).toBeVisible();
  await expect(files.getByRole("link", { name: filename })).toBeVisible();

  // Move to trash again and restore from the trash page.
  await moveToTrash.click();
  await expect(files.getByRole("link", { name: filename })).toHaveCount(0);
  await page.getByRole("link", { name: "Trash", exact: true }).click();
  await expect(page.getByText("Not found", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Trash", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: `Restore ${filename}` }).click();
  await expect(page.getByText(`Restored ${filename}`).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: filename })).toHaveCount(0);

  await open(page, "/app/upload-demo");
  await expect(files.getByRole("link", { name: filename })).toBeVisible();

  // Trash it once more and delete it permanently (the shared user owns its workspace).
  await files
    .getByRole("button", { name: `Move to trash ${filename}` })
    .click();
  await expect(files.getByRole("link", { name: filename })).toHaveCount(0);
  await open(page, "/app/trash");
  await page
    .getByRole("button", { name: `Delete permanently ${filename}` })
    .click();
  const confirm = page.getByRole("alertdialog", {
    name: `Delete ${filename} permanently?`,
  });
  await confirm.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText(`Deleted ${filename} permanently`)).toBeVisible();
  await expect(page.getByRole("cell", { name: filename })).toHaveCount(0);
});
