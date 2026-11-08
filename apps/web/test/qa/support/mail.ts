/**
 * What the checklist expects of every mail (docs/guides/how-to-qa-a-deployment.md): the
 * sender `starter@flooper.me` named "Cloudflare Starter", the subject, links on the
 * environment's origin, and for notifications the RFC 8058 headers. Security notices and
 * auth mails carry no unsubscribe link: `notification: false` checks that too. Built on
 * the suite's `inbox` and `linkTo` (index.ts).
 */
import {
  expect,
  inbox,
  linkTo as linkOnOrigin,
  type QaMail,
  qaEnv,
} from "./index";

export const SENDER = {
  address: "starter@flooper.me",
  name: "Cloudflare Starter",
} as const;

/** The URL in `List-Unsubscribe: <…>` (headers have lowercase names). */
export function unsubscribeUrl(mail: QaMail): string {
  const value = mail.headers["list-unsubscribe"] ?? "";
  const url = /^<([^>]+)>$/.exec(value.trim())?.[1];
  if (!url) throw new Error(`no List-Unsubscribe URL in "${value}"`);
  return url;
}

export function expectAppMail(
  mail: QaMail,
  expected: {
    readonly subject: string | RegExp;
    /** A notification (List-Unsubscribe headers) or a security / auth mail (none). */
    readonly notification: boolean;
  }
): void {
  const origin = qaEnv().baseURL;
  const from = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(mail.from);
  expect(from?.[2]?.toLowerCase(), `sender of "${mail.subject}"`).toBe(
    SENDER.address
  );
  expect(from?.[1], `sender name of "${mail.subject}"`).toBe(SENDER.name);
  if (typeof expected.subject === "string") {
    expect(mail.subject).toBe(expected.subject);
  } else {
    expect(mail.subject).toMatch(expected.subject);
  }
  for (const link of mail.links) {
    expect(new URL(link).origin, `link in "${mail.subject}"`).toBe(origin);
  }
  if (expected.notification) {
    const url = new URL(unsubscribeUrl(mail));
    expect(url.origin).toBe(origin);
    expect(url.pathname).toBe("/api/notifications/unsubscribe");
    expect(mail.headers["list-unsubscribe-post"]).toBe(
      "List-Unsubscribe=One-Click"
    );
  } else {
    expect(mail.headers["list-unsubscribe"]).toBeUndefined();
  }
}

/**
 * Waits for the newest mail to `to` sent since `since` whose subject contains `subject`
 * (a pattern: its fixed part goes to the inbox query), then checks it.
 */
export async function expectMail(
  to: string,
  subject: string | RegExp,
  since: Date,
  notification: boolean,
  fixedPart: string = typeof subject === "string" ? subject : ""
): Promise<QaMail> {
  const mail = await inbox.waitFor({
    to,
    subject: fixedPart || undefined,
    since,
    timeoutMs: 120_000,
  });
  expectAppMail(mail, { subject, notification });
  return mail;
}

/** The mail's link to `path` on the environment's origin (the suite's `linkTo`). */
export function linkTo(mail: QaMail, path: string): string {
  return linkOnOrigin(mail.links, qaEnv().baseURL, path);
}
