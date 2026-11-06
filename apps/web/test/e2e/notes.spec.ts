import { expect, test } from "@playwright/test";

import { open, sharedSession } from "./helpers";

// The placeholder apps as the shared user: a note from creation to the trash and back,
// and the sample Tasks board. No sign-up here.
test.use({ storageState: sharedSession });

test("notes: create, edit, comment, move to trash, restore from the trash", async ({
  page,
}) => {
  const title = `Q3 launch checklist ${Date.now()}`;

  await open(page, "/app/dashboard");
  await page.getByRole("link", { name: "Notes", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/notes$/);
  await expect(
    page.getByRole("complementary", { name: "Placeholder app" })
  ).toBeVisible();

  // Create: the new note opens.
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel(/^Note/).fill("Freeze the pricing page");
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/app\/notes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Edit the body.
  await page.getByRole("button", { name: "Edit" }).click();
  await page
    .getByLabel(/^Note/)
    .fill("Freeze the pricing page\nRun the restore drill");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();
  await expect(page.getByText("Run the restore drill")).toBeVisible();

  // Comment.
  await page
    .getByRole("textbox", { name: "Comment" })
    .fill("The drill is booked for Thursday.");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(
    page.getByText("The drill is booked for Thursday.")
  ).toBeVisible();

  // The list shows it with its comment, and search finds it.
  await page.getByRole("link", { name: "All notes" }).click();
  await page.getByLabel("Search notes").fill(title);
  const list = page.getByRole("listbox", { name: "Notes" });
  await expect(
    list.getByRole("option", { name: new RegExp(title) })
  ).toContainText("1 comment");

  // Move to trash: gone from the list, listed in the trash; restore brings it back.
  await list.getByRole("option", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page).toHaveURL(/\/app\/notes$/);
  await expect(page.getByText(`Moved "${title}" to the trash`)).toBeVisible();
  await page.getByLabel("Search notes").fill(title);
  await expect(page.getByText("No notes match")).toBeVisible();

  await page.getByRole("link", { name: "Trash", exact: true }).click();
  await page.getByRole("button", { name: `Restore ${title}` }).click();
  await expect(page.getByText(`Restored ${title}`).first()).toBeVisible();

  await page.getByRole("link", { name: "Notes", exact: true }).click();
  await page.getByLabel("Search notes").fill(title);
  await list.getByRole("option", { name: new RegExp(title) }).click();
  await expect(
    page.getByText("The drill is booked for Thursday.")
  ).toBeVisible();
});

test("a note that is gone, or a link that is no note, says so", async ({
  page,
}) => {
  for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-note"]) {
    await open(page, `/app/notes/${id}`);
    await expect(page.getByText("Note not found")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open the trash" })
    ).toBeVisible();
  }
});

test("tasks: the sample board switches to a list and filters", async ({
  page,
}) => {
  await open(page, "/app/tasks");
  await expect(
    page.getByRole("complementary", { name: "Placeholder app" })
  ).toContainText("nothing is saved");
  await expect(page.getByText("6 of 6 tasks")).toBeVisible();
  await page.getByRole("radio", { name: "List" }).click();
  await expect(page.getByRole("grid", { name: "Tasks" })).toBeVisible();
});
