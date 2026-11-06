import { expect, test } from "@playwright/test";
import { newAccount, open, signUp } from "./helpers";

// A dedicated account on its own documentation-range client IP: the shared user's uploads
// in other journeys count against the same per-user upload.user quota, and its current
// workspace changes while they run. Signing up here leaves the shared sign-up quota alone.
test.use({ extraHTTPHeaders: { "cf-connecting-ip": "198.51.100.88" } });

test("settings persists profile, image and preferences, then renames and deletes a workspace", async ({
  page,
}) => {
  await signUp(page, newAccount("settings"));
  await open(page, "/app/settings/account");
  const providerImage = new URL("/e2e-provider-avatar.png", page.url()).href;
  await page.route(providerImage, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNioAAAAASUVORK5CYII=",
        "base64"
      ),
    })
  );
  const profile = await page.request.post("/api/auth/update-user", {
    headers: { origin: new URL(page.url()).origin },
    data: { image: providerImage },
  });
  expect(profile.ok()).toBe(true);
  await open(page, "/app/settings/account");
  await expect(
    page.locator(`img[src="${providerImage}"]`).first()
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Settings Example");
  // Saving reloads the page; a file chosen before that reload is lost with the old page.
  const profileSaved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/update-user" &&
      response.request().method() === "POST"
  );
  const reloaded = page.waitForEvent(
    "framenavigated",
    (frame) => frame === page.mainFrame()
  );
  await page.getByRole("button", { name: "Save profile" }).click();
  expect((await profileSaved).ok()).toBe(true);
  await reloaded;
  await open(page, "/app/settings/account");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Settings Example"
  );
  const avatarUpload = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/account/avatar" &&
      response.request().method() === "POST"
  );
  await page.getByLabel("Upload avatar").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNioAAAAASUVORK5CYII=",
      "base64"
    ),
  });
  expect((await avatarUpload).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Remove avatar" })
  ).toBeVisible();
  // Bootstrap must already contain the custom URL, as it does on a later visit.
  await open(page, "/app/settings/account");
  await expect(
    page.locator('img[src*="/api/account/avatar/"]').first()
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove avatar" }).click();
  await expect(page.getByRole("button", { name: "Remove avatar" })).toHaveCount(
    0
  );
  await expect(page.locator('img[src*="/api/account/avatar/"]')).toHaveCount(0);
  await open(page, "/app/settings/account");
  await expect(page.locator('img[src*="/api/account/avatar/"]')).toHaveCount(0);
  await expect(
    page.locator(`img[src="${providerImage}"]`).first()
  ).toBeVisible();
  const resetImage = await page.request.post("/api/auth/update-user", {
    headers: { origin: new URL(page.url()).origin },
    data: { image: null },
  });
  expect(resetImage.ok()).toBe(true);
  await page.getByRole("link", { name: "Appearance & language" }).click();
  await page.getByLabel("Theme", { exact: true }).click();
  await page.getByRole("option", { name: "Light", exact: true }).click();
  await page.getByLabel("Time zone").fill("Europe/Prague");
  await page.getByLabel("Locale", { exact: true }).fill("cs-CZ");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Prague");
  await page.getByLabel("Theme", { exact: true }).click();
  await page.getByRole("option", { name: "System", exact: true }).click();
  await page.getByLabel("Locale", { exact: true }).fill("en");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await page.getByRole("link", { name: "Security", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out this session", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: /workspace menu/ }).click();
  await page.getByRole("menuitem", { name: /create workspace/i }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Settings temporary");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Workspace", exact: true }).click();
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("Settings renamed");
  await page.getByRole("button", { name: "Save workspace" }).click();
  await expect(
    page.getByRole("button", { name: /workspace menu/ })
  ).toContainText("Settings renamed");
  await page.getByLabel("Confirm workspace name").fill("wrong");
  await expect(
    page.getByRole("button", { name: "Delete workspace", exact: true })
  ).toBeDisabled();
  await page.getByLabel("Confirm workspace name").fill("Settings renamed");
  await page
    .getByRole("button", { name: "Delete workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/dashboard$/);
});
