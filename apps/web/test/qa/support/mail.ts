/**
 * What the checklist expects of every mail (docs/guides/how-to-qa-a-deployment.md, rules
 * for a run): the sender `starter@flooper.me` named "Cloudflare Starter", the subject,
 * links on the environment's origin, and for notifications the RFC 8058 headers.
 * Security notices carry no unsubscribe link: `notification: false` checks that too.
 */
import { qaEnv } from "./env";
import { expect } from "./fixture";
import { inbox, type Mail } from "./inbox";

export const SENDER = {
  address: "starter@flooper.me",
  name: "Cloudflare Starter",
} as const;

/** A header of the mail, by case-insensitive name. */
export function header(mail: Mail, name: string): string | undefined {
  const wanted = name.toLowerCase();
  return Object.entries(mail.headers).find(
    ([key]) => key.toLowerCase() === wanted
  )?.[1];
}

/** The URL in `List-Unsubscribe: <…>`. */
export function unsubscribeUrl(mail: Mail): string {
  const value = header(mail, "List-Unsubscribe") ?? "";
  const url = /^<([^>]+)>$/.exec(value.trim())?.[1];
  if (!url) throw new Error(`no List-Unsubscribe URL in "${value}"`);
  return url;
}

export function expectAppMail(
  mail: Mail,
  expected: {
    readonly subject: string | RegExp;
    /** A notification (List-Unsubscribe headers) or a security / auth mail (none). */
    readonly notification: boolean;
  }
): void {
  const origin = qaEnv().baseUrl;
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
    expect(new URL(unsubscribeUrl(mail)).origin).toBe(origin);
    expect(new URL(unsubscribeUrl(mail)).pathname).toBe(
      "/api/notifications/unsubscribe"
    );
    expect(header(mail, "List-Unsubscribe-Post")).toBe(
      "List-Unsubscribe=One-Click"
    );
  } else {
    expect(header(mail, "List-Unsubscribe")).toBeUndefined();
  }
}

/** Waits for a mail to `to` with `subject` sent at or after `since`, then checks it. */
export async function expectMail(
  to: string,
  subject: string | RegExp,
  since: number,
  notification: boolean
): Promise<Mail> {
  const mail = await inbox.waitFor({ to, subject, since, timeoutMs: 90_000 });
  expectAppMail(mail, { subject, notification });
  return mail;
}

/** The first link of the mail whose path starts with `path`. */
export function linkTo(mail: Mail, path: string): string {
  const link = mail.links.find((href) =>
    new URL(href).pathname.startsWith(path)
  );
  if (!link) throw new Error(`"${mail.subject}" has no link to ${path}`);
  return link;
}
