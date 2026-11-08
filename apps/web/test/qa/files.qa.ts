import { createVerifiedAccount } from "./support";
import { QA_ADMIN_SKIP, signInQaAdmin } from "./support/admin";
import { tinyPng } from "./support/files";
import {
  expect,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { createWorkspace, open } from "./support/session";

// Checklist: Files (both upload paths and limits). One account, in a workspace of its
// own. Small generated files only (a few dozen bytes). The limit step needs the QA admin
// (a storage override is an admin action) and skips with the reason without it.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
const workspace = `QA ${process.env.QA_RUN_ID ?? "run"} files`;

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  await createVerifiedAccount(page, { role: "files" });
  await createWorkspace(page, workspace);
});

test.afterAll(async () => {
  await page?.context().close();
});

test("a PNG through the FILES binding is listed and its link serves the same bytes, to its owner only", async ({
  playwright,
}) => {
  const png = tinyPng();
  await open(page, "/app/upload-demo");
  await expect(
    page.getByRole("heading", { name: "Two ways into R2" })
  ).toBeVisible();
  await page.locator("#binding-upload-file").setInputFiles({
    name: "qa-binding.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByText(/Status: Stored as /)).toBeVisible();
  const files = page.getByRole("list", { name: "Workspace files" });
  await expect(
    files.getByRole("link", { name: "qa-binding.png" })
  ).toBeVisible();
  await expect(files).toContainText(/image\/png|PNG/i);

  const href = await page
    .getByRole("link", { name: "Open file" })
    .getAttribute("href");
  const response = await page.request.get(href as string);
  expect(response.status()).toBe(200);
  expect(Buffer.from(await response.body()).equals(png)).toBe(true);

  const anonymous = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const refused = await anonymous.get(
    new URL(href as string, page.url()).href,
    {
      maxRedirects: 0,
    }
  );
  expect(refused.status()).toBe(404);
  await anonymous.dispose();
});

test("a PNG through a presigned URL goes straight to R2 and downloads the same bytes", async () => {
  const png = tinyPng(2);
  await open(page, "/app/upload-demo");
  await page.locator("#presigned-upload-file").setInputFiles({
    name: "qa-presigned.png",
    mimeType: "image/png",
    buffer: png,
  });
  const done = page.getByText("Upload complete. Signed download URL minted.");
  const failed = page.getByText("Not uploaded.");
  await expect(done.or(failed)).toBeVisible();
  test.skip(
    await failed.isVisible(),
    "presigned uploads are not configured for this environment (R2 S3 credentials): N/A"
  );
  const href = await page
    .getByRole("link", { name: "Open signed download URL" })
    .getAttribute("href");
  const response = await page.request.get(href as string);
  expect(response.status()).toBe(200);
  expect(Buffer.from(await response.body()).equals(png)).toBe(true);
});

test("over the storage limit an upload is refused before storing, with an upgrade prompt", async ({
  browser,
}) => {
  const adminPage = await newUserPage(browser);
  try {
    const isAdmin = await signInQaAdmin(adminPage);
    test.skip(!isAdmin, QA_ADMIN_SKIP);
    // The admin gives this workspace a storage limit of 0 MB (an override, with a reason).
    await open(adminPage, "/admin/workspaces");
    await adminPage
      .getByRole("searchbox", { name: "Search workspaces" })
      .fill(workspace);
    await adminPage.getByText(workspace, { exact: true }).click();
    const override = adminPage.getByRole("form", { name: "Override" });
    await override.getByLabel("Limit (MB)").fill("0");
    await override
      .getByLabel("Reason")
      .fill(`QA ${process.env.QA_RUN_ID} files limit`);
    await override.getByRole("button", { name: "Set override" }).click();
    await expect(adminPage.getByText("Override set")).toBeVisible();

    await open(page, "/app/upload-demo");
    await page.locator("#binding-upload-file").setInputFiles({
      name: "qa-over-limit.png",
      mimeType: "image/png",
      buffer: tinyPng(3),
    });
    await expect(
      page.getByText("You've reached the storage limit")
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Workspace files" }).getByRole("link", {
        name: "qa-over-limit.png",
      })
    ).toHaveCount(0);
    await page.getByRole("link", { name: "View plan and usage" }).click();
    await expect(page).toHaveURL(/\/app\/billing$/);
    await expect(
      page.getByText(/^(Limit reached|Over limit)$/).first()
    ).toBeVisible();

    await override
      .getByLabel("Reason")
      .fill(`QA ${process.env.QA_RUN_ID} done`);
    await override.getByRole("button", { name: "Remove override" }).click();
    await expect(adminPage.getByText("Override removed")).toBeVisible();
  } finally {
    await adminPage.context().close();
  }
});
