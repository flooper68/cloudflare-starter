/** A mailbox: an address and an optional display name (the email port's recipient). */
export interface Mailbox {
  readonly email: string;
  readonly name?: string;
}

/** Mail in the QA outbox is kept this long; reads never return older mail. */
export const QA_OUTBOX_RETENTION_MS = 24 * 60 * 60 * 1000;

/** The nightly cleanup erases only run accounts at least this old (never a running suite's). */
export const QA_LEFTOVER_MIN_AGE_MS = 2 * 60 * 60 * 1000;

/** At most this many accounts per cleanup call. */
export const QA_CLEANUP_BATCH = 20;

/** At most this many messages per read, newest first. */
export const QA_OUTBOX_PAGE_SIZE = 50;

/** The oldest time a message may have been stored to still be in the outbox. */
export function qaOutboxCutoff(now: Date): Date {
  return new Date(now.getTime() - QA_OUTBOX_RETENTION_MS);
}

/**
 * The QA suite's per-run addresses, `qa+<yyyymmdd><4 letters>-<role>@<domain>`
 * (apps/web/test/qa/support/address.ts): the only ones the read endpoint serves. Mail to
 * other QA addresses (the QA admin's `qa+admin@`) is stored but never served, so the QA
 * token alone never reads a password reset for the QA admin.
 */
export function isQaRunAddress(email: string, domain: string): boolean {
  const match = /^qa\+\d{8}[a-z]{4}-[a-z0-9]{1,20}@(.+)$/.exec(
    email.trim().toLowerCase()
  );
  return Boolean(match && match[1] === domain.toLowerCase());
}

function formatAddress(recipient: Mailbox): string {
  return recipient.name
    ? `"${recipient.name.replaceAll(/["\\]/g, "")}" <${recipient.email}>`
    : recipient.email;
}

/**
 * The header fields of the message as it would have gone out, names lowercased: From, To,
 * Subject, a Message-ID on the sender's domain, MIME-Version, then the message's own
 * extra headers (List-Unsubscribe, List-Unsubscribe-Post). Cloudflare Email Service sets
 * its own Message-ID when it sends; this one stands in for it.
 */
export function renderedHeaders(input: {
  readonly from: Mailbox;
  readonly to: Mailbox;
  readonly subject: string;
  readonly id: string;
  readonly date: Date;
  readonly headers?: Readonly<Record<string, string>>;
}): Record<string, string> {
  const domain = input.from.email.split("@")[1] ?? "localhost";
  const headers: Record<string, string> = {
    from: formatAddress(input.from),
    to: formatAddress(input.to),
    subject: input.subject,
    date: input.date.toUTCString(),
    "message-id": `<${input.id}@${domain}>`,
    "mime-version": "1.0",
  };
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers[name.toLowerCase()] = value;
  }
  return headers;
}
