import { type QaEnv, qaEnv } from "./env";
import { inbox } from "./inbox";
import { linkTo } from "./links";
import { qaPassword } from "./password";
import { QA_TOKEN_HEADER } from "./routing";

/** The QA admin: `qa+admin@<QA_EMAIL_DOMAIN>`, its password derived from QA_TOKEN. */
export function qaAdmin(env: QaEnv = qaEnv()): {
  readonly email: string;
  readonly password: string;
} {
  const email = `qa+admin@${env.emailDomain}`;
  return { email, password: qaPassword(email, env.token) };
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
 * unverified it opens the verification link from the QA outbox. The app promotes it to
 * platform admin once verified (QA_BYPASS=on; docs/guides/how-to-configure-abuse-protection.md#the-qa-admin).
 * Run once per `playwright test` by the global setup. Throws with what to do when the
 * account exists with another password (QA_TOKEN was rotated).
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
