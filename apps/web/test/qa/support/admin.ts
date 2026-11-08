/**
 * The QA admin: `qa+admin@<QA_EMAIL_DOMAIN>`, self-provisioned like every QA account (its
 * password is derived from the QA token, support/password.ts) and promoted by the app
 * while QA_BYPASS=on (docs/guides/how-to-configure-abuse-protection.md#the-qa-admin). The
 * global setup makes sure it exists and is verified (`ensureQaAdmin`); journeys sign in as
 * it with `signInQaAdmin(page)` and act only on the run's own accounts and workspaces.
 * There is no owner step and no skip.
 */
import type { Page } from "@playwright/test";
import { open } from "./app";
import { type QaEnv, qaEnv } from "./env";
import { expect } from "./fixtures";
import { inbox } from "./inbox";
import { linkTo } from "./links";
import { qaPassword } from "./password";
import { QA_TOKEN_HEADER } from "./routing";
import { type Account, AUTH_WAIT, submitSignIn } from "./session";

/** The QA admin: `qa+admin@<QA_EMAIL_DOMAIN>`, its password derived from QA_TOKEN. */
export function qaAdmin(env: QaEnv = qaEnv()): Account {
  const email = `qa+admin@${env.emailDomain}`;
  return { email, password: qaPassword(email, env.token) };
}

/** The same as `qaAdmin()` (the name the journeys of #54 use). */
export function qaAdminAccount(): Account {
  return qaAdmin();
}

async function authPost(
  env: QaEnv,
  path: string,
  body: Record<string, string>
): Promise<{ readonly status: number; readonly code: string | null }> {
  const response = await fetch(`${env.baseURL}/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: env.baseURL,
      [QA_TOKEN_HEADER]: env.token,
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as {
    code?: string;
  } | null;
  return { status: response.status, code: json?.code ?? null };
}

/**
 * Makes sure the QA admin exists, is verified and can sign in, with nothing from the
 * owner: signs in; if the account is missing it signs up through the QA bypass; if it is
 * unverified it opens the verification link from the QA outbox. The app promotes it once
 * verified. Run once per `playwright test` by the global setup. Throws with what to do
 * when the account exists with another password (QA_TOKEN was rotated).
 */
export async function ensureQaAdmin(env: QaEnv = qaEnv()): Promise<void> {
  const admin = qaAdmin(env);
  const signIn = () =>
    authPost(env, "/sign-in/email", {
      email: admin.email,
      password: admin.password,
    });
  let result = await signIn();
  if (result.status === 200) return;
  const since = new Date(Date.now() - 30_000);
  if (result.code === "INVALID_EMAIL_OR_PASSWORD") {
    const created = await authPost(env, "/sign-up/email", {
      name: "QA admin",
      email: admin.email,
      password: admin.password,
    });
    if (created.status !== 200) {
      throw new Error(
        created.code === "USER_ALREADY_EXISTS" ||
          created.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? `the QA admin ${admin.email} exists with another password (QA_TOKEN changed?): erase it in the admin portal, the next run creates it again`
          : `signing up the QA admin answered ${created.status} ${created.code ?? ""}`
      );
    }
  } else if (result.code === "EMAIL_NOT_VERIFIED") {
    await authPost(env, "/send-verification-email", { email: admin.email });
  } else {
    throw new Error(
      `signing in as the QA admin answered ${result.status} ${result.code ?? ""}`
    );
  }
  const mail = await inbox.waitFor({
    to: admin.email,
    subject: "Verify your email",
    since,
    timeoutMs: 60_000,
  });
  const verified = await fetch(
    linkTo(mail.links, env.baseURL, "/api/auth/verify-email"),
    { redirect: "manual", headers: { [QA_TOKEN_HEADER]: env.token } }
  );
  if (verified.status >= 400) {
    throw new Error(`verifying the QA admin answered ${verified.status}`);
  }
  result = await signIn();
  if (result.status !== 200) {
    throw new Error(
      `signing in as the verified QA admin answered ${result.status} ${result.code ?? ""}`
    );
  }
}

/**
 * Signs the QA admin in on `page` (the global setup provisioned it) and checks it may open
 * the admin portal: it is an admin only within an hour of a browser sign-in, so sign in
 * fresh in every journey that needs it. Throws when it cannot: a missing admin is a
 * failure of the environment, not a reason to skip.
 */
export async function signInQaAdmin(page: Page): Promise<Account> {
  const account = qaAdmin();
  await submitSignIn(page, account.email, account.password);
  await expect(page, "the QA admin signs in").toHaveURL(/\/app\/dashboard$/, {
    timeout: AUTH_WAIT,
  });
  const portal = await page.goto("/admin/overview");
  expect(
    portal?.status(),
    "the QA admin may open the admin portal (the app promotes it while QA_BYPASS is on)"
  ).toBe(200);
  await open(page, "/admin/overview");
  return account;
}
