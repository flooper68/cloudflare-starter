import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { open } from "./support/session";

// Checklist: Placeholder apps, Notes and Tasks. One account. The checklist's step where
// a member (B) comments on the note needs a second account; the comment thread itself is
// covered here as the owner, and a member's access by the API tests
// (apps/web/test/api/notes.test.ts), to keep the run's sign-ups low.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
const title = `QA ${process.env.QA_RUN_ID ?? "run"} note`;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  await newQaAccount(page, { role: "notes" });
});

test.afterAll(async () => {
  await page?.context().close();
});

test("Notes shows the placeholder notice and an empty state with New note", async () => {
  await open(page, "/app/dashboard");
  await page.getByRole("link", { name: "Notes", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/notes$/);
  await expect(
    page.getByRole("complementary", { name: "Placeholder app" })
  ).toBeVisible();
  await expect(page.getByText("No notes yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New note" }).first()
  ).toBeVisible();
});

test("a note is created, edited and commented; the dashboard step is done", async () => {
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("textbox", { name: /^Note/ }).fill("First line");
  await page.getByRole("button", { name: "Create note" }).click();
  await expect(page).toHaveURL(/\/app\/notes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page
    .getByRole("textbox", { name: /^Note/ })
    .fill("First line\nSecond line");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Note saved")).toBeVisible();
  await expect(page.getByText("Second line")).toBeVisible();

  const composer = page.getByRole("textbox", { name: "Comment" });
  await composer.fill("QA comment");
  await page.getByRole("button", { name: "Send comment" }).click();
  // In the thread, and the composer emptied: the comment is saved. (The composer's own
  // text matches "QA comment" too, so that alone passed before the request answered, and
  // the next navigation cancelled it.)
  await expect(
    page.getByRole("article").filter({ hasText: "QA comment" })
  ).toBeVisible();
  await expect(composer).toHaveValue("");

  await open(page, "/app/dashboard");
  await expect(page.getByRole("list", { name: "Get started" })).toContainText(
    "Write your first note (done)"
  );
  await open(page, "/app/billing");
  await expect(page.locator("main")).toContainText("Notes");
});

test("search finds it; the trash takes it out of the list and restores it with its comment", async () => {
  await open(page, "/app/notes");
  await page.getByLabel("Search notes").fill(title);
  const list = page.getByRole("listbox", { name: "Notes" });
  await expect(
    list.getByRole("option", { name: new RegExp(title) })
  ).toContainText("1 comment");
  await list.getByRole("option", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page).toHaveURL(/\/app\/notes$/);
  await page.getByLabel("Search notes").fill(title);
  await expect(page.getByText("No notes match")).toBeVisible();

  await page.getByRole("link", { name: "Trash", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: title })).toBeVisible();
  await page.getByRole("button", { name: `Restore ${title}` }).click();
  await expect(page.getByText(`Restored ${title}`).first()).toBeVisible();
  await open(page, "/app/notes");
  await page.getByLabel("Search notes").fill(title);
  await list.getByRole("option", { name: new RegExp(title) }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "QA comment" })
  ).toBeVisible();
});

test("Tasks: the sample board, the list view, and sample data that starts over on reload", async () => {
  await open(page, "/app/tasks");
  await expect(
    page.getByRole("complementary", { name: "Placeholder app" })
  ).toContainText("nothing is saved");
  await expect(page.getByText("6 of 6 tasks")).toBeVisible();
  await page.getByRole("radio", { name: "List" }).click();
  await expect(page.getByRole("grid", { name: "Tasks" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("6 of 6 tasks")).toBeVisible();
});
