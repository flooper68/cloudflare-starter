import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, test } from "@playwright/test";
import { newAccount, open, signOut, signUp } from "./helpers";

// A dedicated synthetic browser identity so factor enrollment never replaces the shared
// fixture's session. The separate local client IP preserves the real per-IP rate policy.
test("authenticator, passkey sign-in and recovery enforce the second factor", async ({
  browser,
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { "cf-connecting-ip": "198.51.100.80" },
  });
  const page = await context.newPage();
  const device = await context.newCDPSession(page);
  await device.send("WebAuthn.enable");
  const { authenticatorId } = await device.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    }
  );
  try {
    const account = newAccount("security");
    await signUp(page, account);
    await open(page, "/app/settings/security");
    await page
      .getByLabel("Password for security changes")
      .fill(account.password);
    const setupResponse = page.waitForResponse((response) =>
      response.url().endsWith("/two-factor/enable")
    );
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    const setup = (await (await setupResponse).json()) as {
      totpURI: string;
      backupCodes: string[];
    };
    const otp = () =>
      createOTP(
        base32.decode(new URL(setup.totpURI).searchParams.get("secret") ?? "")
      ).totp();
    await page.getByLabel("Verification code").fill(await otp());
    await page.getByRole("button", { name: "Verify and enable" }).click();
    await expect(page.getByText("Save your recovery codes")).toBeVisible();
    await page
      .getByRole("button", { name: "I saved my recovery codes" })
      .click();
    await expect(
      page.getByText("Your authenticator protects your sign-ins.")
    ).toBeVisible();
    await page.getByLabel("Passkey name").fill("Test laptop");
    await page
      .getByRole("button", { name: "Add passkey", exact: true })
      .click();
    await expect(page.getByText("Test laptop", { exact: true })).toBeVisible();
    await signOut(page);

    await open(page, "/sign-in");
    await page.getByRole("button", { name: "Sign in with a passkey" }).click();
    await expect(page).toHaveURL(/\/two-factor/);
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
    const pending = await page.request.get("/api/auth/get-session");
    expect(await pending.json()).toBeNull();
    await page.getByLabel("Verification code").fill(await otp());
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
    await signOut(page);

    await open(page, "/sign-in");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/two-factor/);
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
    await page.getByRole("button", { name: "Use a recovery code" }).click();
    await page.getByLabel("Recovery code").fill(setup.backupCodes[0] ?? "");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/dashboard$/);
  } finally {
    if (!page.isClosed())
      await device.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
    await context.close();
  }
});
