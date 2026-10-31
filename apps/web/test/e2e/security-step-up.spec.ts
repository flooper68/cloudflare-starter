import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, type Page, test } from "@playwright/test";
import { newAccount, open, readAdminAccounts, signUp } from "./helpers";

const repo = fileURLToPath(new URL("../../../..", import.meta.url));
const web = fileURLToPath(new URL("../..", import.meta.url));
const evidence = process.env.SECURITY_REVIEW_EVIDENCE_DIR;
async function shot(page: Page, name: string) {
  if (!evidence) return;
  mkdirSync(evidence, { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === "running" &&
              Number.isFinite(animation.effect?.getComputedTiming().endTime)
          )
          .map((animation) => animation.finished.catch(() => {}))
      );
    });
    await page.screenshot({
      animations: "disabled",
      path: join(evidence, `${name}-${theme}.png`),
      fullPage: true,
    });
  }
}

// This fixture is the exact server-owned state produced by a remembered-device sign-in,
// covered through native cookies in security-review/security API tests. It keeps the
// default local policy at zero remembered days while exercising the durable admin UI flow.
test("a remembered administrator verifies a fresh factor and returns to the interrupted action", async ({
  browser,
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { "cf-connecting-ip": "198.51.100.84" },
  });
  const page = await context.newPage();
  try {
    const admin = newAccount("step-up-admin");
    await signUp(page, admin);
    execFileSync("bun", ["scripts/setup-admin.ts", "--email", admin.email], {
      cwd: repo,
      stdio: "pipe",
    });
    await open(page, "/app/settings/security");
    await page.getByLabel("Password for security changes").fill(admin.password);
    const response = page.waitForResponse((result) =>
      result.url().endsWith("/two-factor/enable")
    );
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    const setup = (await (await response).json()) as { totpURI: string };
    const otp = () =>
      createOTP(
        base32.decode(new URL(setup.totpURI).searchParams.get("secret") ?? "")
      ).totp();
    await page.getByLabel("Verification code").fill(await otp());
    await page.getByRole("button", { name: "Verify and enable" }).click();
    await page
      .getByRole("button", { name: "I saved my recovery codes" })
      .click();
    await expect(
      page.getByText("Your authenticator protects your sign-ins.")
    ).toBeVisible();
    const current = (await (
      await page.request.get("/api/auth/get-session")
    ).json()) as { session: { id: string } };
    expect(current.session.id).toMatch(/^[A-Za-z0-9_-]+$/);
    execFileSync(
      "bun",
      [
        "x",
        "wrangler",
        "d1",
        "execute",
        "DB",
        "--local",
        "--command",
        `UPDATE session SET amr = 'mfa', second_factor_at = ${Date.now()} WHERE id = '${current.session.id}'`,
      ],
      { cwd: web, stdio: "pipe" }
    );
    const { member } = readAdminAccounts();
    await open(page, "/admin/users");
    await page
      .getByRole("searchbox", { name: "Search users" })
      .fill(member.email);
    await page.getByText(member.email).click();
    const destination = new URL(page.url()).pathname;
    await page
      .getByRole("button", {
        name: "Reset two-factor authentication",
        exact: true,
      })
      .click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await shot(page, "01-admin-reset-confirmation");
    await confirm
      .getByRole("button", {
        name: "Reset two-factor authentication",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/two-factor\?stepUp=1&next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(destination);
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
    await expect(page.getByText("Verify it's you")).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await shot(page, "02-forced-admin-challenge");
    const actual = await otp();
    const wrong = String((Number(actual) + 1) % 1_000_000).padStart(6, "0");
    await page.getByLabel("Verification code").fill(wrong);
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await shot(page, "03-forced-admin-invalid-code");
    await page.getByLabel("Verification code").fill(await otp());
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Reset two-factor authentication",
        exact: true,
      })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", {
        name: "Reset two-factor authentication",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Two-factor authentication reset")
    ).toBeVisible();
    await shot(page, "04-admin-reset-completed");
  } finally {
    await context.close();
  }
});
