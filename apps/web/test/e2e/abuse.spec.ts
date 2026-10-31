import { expect, test } from "@playwright/test";

import { open } from "./helpers";

// Abuse protection in the browser: the Turnstile widget (Cloudflare's always-pass test
// site key from .dev.vars.example, simulated locally) gates the auth forms, and a
// rate-limited request shows the notice. The sign-up journey itself (auth.spec.ts) passes
// through the widget too. This file signs nobody up: sign-up is limited to 5 a minute.

test("the sign-up form waits for the human check, then allows submitting", async ({
  page,
}) => {
  await open(page, "/sign-up");
  const submit = page.getByRole("button", { name: "Create account" });
  await expect(page.getByRole("group", { name: "Human check" })).toBeVisible();
  await expect(submit).toBeDisabled();
  // The test widget passes on its own after a moment; the disabled state remains real.
  await expect(submit).toBeEnabled({ timeout: 20_000 });
});

test("the sign-in and forgot-password forms show the human check", async ({
  page,
}) => {
  for (const path of ["/sign-in", "/forgot-password"]) {
    await open(page, path);
    await expect(
      page.getByRole("group", { name: "Human check" })
    ).toBeVisible();
  }
});

test("too many reset requests show the rate-limit notice", async ({
  page,
  baseURL,
}) => {
  // Its own client IP, so this test's counters never touch the other journeys'. Only on
  // the app's own requests: Cloudflare's Turnstile script refuses unexpected headers.
  const octet = () => Math.floor(Math.random() * 250) + 1;
  const ip = `10.${octet()}.${octet()}.${octet()}`;
  await page.route(
    (url) => url.origin === baseURL,
    (route) =>
      route.continue({
        headers: { ...route.request().headers(), "cf-connecting-ip": ip },
      })
  );

  // auth.password-reset allows 3 a minute per IP; the 4th is refused.
  for (let request = 1; request <= 4; request++) {
    await open(page, "/forgot-password");
    await page.getByLabel("Email").fill("nobody@example.test");
    const submit = page.getByRole("button", { name: "Send reset link" });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();
    if (request < 4) {
      await expect(page.getByText(/a reset link is on its way/)).toBeVisible();
    }
  }

  const notice = page.getByRole("alert").filter({
    hasText: "Too many reset requests",
  });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(/Try again in \d+:\d\d\./);
  await expect(
    page.getByRole("button", { name: "Send reset link" })
  ).toBeDisabled();
});

test("guessing invitation links is refused per IP (token.lookup)", async ({
  request,
}) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  const ip = `10.${octet()}.${octet()}.${octet()}`;
  // 30 lookups a minute per IP; windows align to the minute, so allow two windows.
  let refused: Awaited<ReturnType<typeof request.get>> | null = null;
  for (let attempt = 0; attempt < 61 && !refused; attempt++) {
    const guess = `${attempt}`.padStart(64, "0");
    const response = await request.get(`/invite/${guess}`, {
      headers: { "cf-connecting-ip": ip },
    });
    if (response.status() === 429) refused = response;
  }
  expect(refused, "never rate limited").not.toBeNull();
  expect(refused?.headers()["retry-after"]).toBe("60");
  expect(refused?.headers()["content-type"]).toBe("application/problem+json");
  expect(await refused?.json()).toMatchObject({
    code: "RATE_LIMITED",
    "violated-policies": ["token.lookup"],
  });
});
