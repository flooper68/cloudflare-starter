import { readFileSync } from "node:fs";

import { tinyPng } from "./support/files";
import {
  expect,
  newQaAccount,
  newUserPage,
  type Page,
  skipWithoutQaEnv,
  test,
} from "./support/journey";
import { expectMail, linkTo } from "./support/mail";
import {
  type Account,
  createWorkspace,
  open,
  openSettings,
} from "./support/session";
import { readZip } from "./support/zip";

// Checklist: Privacy (export download; account erasure is the run's cleanup). One
// account: a personal export and, as the owner, the export of a workspace holding an
// uploaded file. Each export sends one "Your data export is ready" mail.
skipWithoutQaEnv();
test.describe.configure({ mode: "serial" });

let page: Page;
let account: Account;
const workspace = `QA ${process.env.QA_RUN_ID ?? "run"} export`;
const filename = "qa-export.png";
const png = tinyPng(9);

test.beforeAll(async ({ browser }) => {
  page = await newUserPage(browser);
  account = { ...(await newQaAccount(page, { role: "privacy" })) };
});

test.afterAll(async () => {
  await page?.context().close();
});

/** Requests an export with `button`, waits until it is ready, downloads it. */
async function exportOnce(
  button: string,
  kind: "Personal export" | "Workspace export"
): Promise<{ archive: Buffer; mailLink: string }> {
  const since = new Date();
  await openSettings(page, "privacy");
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByText("Data export queued")).toBeVisible();
  const mail = await expectMail(
    account.email,
    "Your data export is ready",
    since,
    false
  );
  const mailLink = linkTo(mail, "/api/privacy/exports/");
  const ready = page
    .getByRole("listitem")
    .filter({ hasText: kind })
    .getByRole("button", { name: "Download", exact: true });
  await expect(async () => {
    await page.getByRole("button", { name: "Refresh exports" }).click();
    await expect(ready).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  const download = page.waitForEvent("download");
  await ready.click();
  const path = await (await download).path();
  return { archive: readFileSync(path), mailLink };
}

/** No secrets in any data file: no password hashes, tokens or recovery codes. */
function expectNoSecrets(entries: Map<string, Buffer>) {
  for (const [name, body] of entries) {
    if (!name.startsWith("data/") && name !== "manifest.json") continue;
    const text = body.toString("utf8");
    expect(text, name).not.toMatch(
      /"(password|accessToken|refreshToken|idToken|token|secret|backupCodes)"\s*:/
    );
    expect(text, name).not.toMatch(/\$argon2|\$2[aby]\$|scrypt:/);
  }
}

test("a personal export is ready, downloads as a sane ZIP and the mail's link serves the same file", async ({
  playwright,
}) => {
  const { archive, mailLink } = await exportOnce(
    "Request personal export",
    "Personal export"
  );
  const entries = readZip(archive);
  const manifest = JSON.parse(
    entries.get("manifest.json")?.toString("utf8") ?? "null"
  );
  expect(manifest?.format).toBe(1);
  expect(
    [...entries.keys()].some((name) => name.startsWith("data/user/"))
  ).toBe(true);
  for (const [name, body] of entries) {
    if (name.endsWith(".ndjson")) {
      for (const line of body.toString("utf8").split("\n").filter(Boolean))
        JSON.parse(line);
    }
  }
  expectNoSecrets(entries);

  const fromMail = await page.request.get(mailLink);
  expect(fromMail.status()).toBe(200);
  expect(Buffer.from(await fromMail.body()).equals(archive)).toBe(true);

  // Signed out, the same link answers 404.
  const anonymous = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  });
  expect((await anonymous.get(mailLink, { maxRedirects: 0 })).status()).toBe(
    404
  );
  await anonymous.dispose();

  // The bell links to the same archive.
  await open(page, "/app/dashboard");
  await page.getByRole("button", { name: /^Notifications(?:,|$)/ }).click();
  const bell = page.getByRole("dialog", { name: "Notifications", exact: true });
  const bellDownload = page.waitForEvent("download");
  await bell
    .getByRole("link", { name: "Your data export is ready", exact: true })
    .first()
    .click();
  expect(readFileSync(await (await bellDownload).path()).equals(archive)).toBe(
    true
  );
});

test("the owner's workspace export holds the uploaded file under files/", async () => {
  await createWorkspace(page, workspace);
  await open(page, "/app/upload-demo");
  await page.locator("#binding-upload-file").setInputFiles({
    name: filename,
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByText(/Status: Stored as /)).toBeVisible();
  const { archive } = await exportOnce(
    "Export current workspace",
    "Workspace export"
  );
  const entries = readZip(archive);
  expect(entries.has("manifest.json")).toBe(true);
  const stored = [...entries].find(
    ([name, body]) => name.startsWith("files/") && body.equals(png)
  );
  expect(
    stored,
    `the uploaded file under files/ in ${[...entries.keys()].join(", ")}`
  ).toBeTruthy();
  expectNoSecrets(entries);
});
