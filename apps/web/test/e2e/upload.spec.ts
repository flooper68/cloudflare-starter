import { expect, test } from "@playwright/test";

import { open, sharedSession } from "./helpers";

test.use({ storageState: sharedSession });

test("upload a file through the FILES binding and read it back", async ({
  page,
  playwright,
}) => {
  const content = `Release notes ${Date.now()}\n`;

  await open(page, "/app/upload-demo");
  await expect(
    page.getByRole("heading", { name: "Two ways into R2" })
  ).toBeVisible();

  // The binding card's input (the presigned card has its own "Choose a file").
  await page.locator("#binding-upload-file").setInputFiles({
    name: "release-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(content),
  });
  await expect(page.getByText(/Status: Stored as /)).toBeVisible();

  // The link serves the file only to its owner: read it with this session's cookies.
  const href = await page
    .getByRole("link", { name: "Open file" })
    .getAttribute("href");
  expect(href).toBeTruthy();
  const response = await page.request.get(href as string);
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe(content);

  // Anyone else, here a request without a session, gets 404.
  // An explicit empty state: the test runner otherwise applies `use.storageState`.
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
