/**
 * STUB: the QA infrastructure PR replaces this file with the client of its test inbox
 * Worker. Contract: `inbox.waitFor({ to, subject?, since, timeoutMs })` resolves with the
 * newest matching mail `{ subject, from, text, html, headers, links }`, and
 * `inbox.clear(to)` forgets what that address received so far.
 *
 * Until then it reads one inbox: the mail the local `send_email` simulation captured,
 * through Miniflare's Local Explorer API that `astro dev` serves
 * (QA_INBOX_URL=http://localhost:<port>/cdn-cgi/local/explorer/api/local/email/sending).
 * Those are the real messages the app sent, with their headers; nothing is delivered.
 */
import { qaEnv } from "./env";

export interface Mail {
  readonly subject: string;
  /** As the From header reads, e.g. `"Cloudflare Starter" <starter@flooper.me>`. */
  readonly from: string;
  readonly text: string;
  readonly html: string;
  /** Extra headers the app set (List-Unsubscribe, …); look names up case-insensitively. */
  readonly headers: Readonly<Record<string, string>>;
  /** Every http(s) link in the text and HTML parts, in order, without duplicates. */
  readonly links: readonly string[];
}

export interface WaitForMail {
  readonly to: string;
  /** Exact subject, or a pattern. */
  readonly subject?: string | RegExp;
  /** Only mail sent at or after this moment (epoch ms or a Date). */
  readonly since: number | Date;
  readonly timeoutMs: number;
}

interface ExplorerItem {
  readonly messageId: string;
  readonly from: string;
  readonly to: readonly string[];
  readonly subject: string;
  readonly sentAt: string;
}

interface ExplorerDetail extends ExplorerItem {
  readonly text?: string;
  readonly html?: string;
  readonly headers?: Record<string, string>;
}

const clearedAt = new Map<string, number>();

function explorer(): string {
  const { inboxUrl } = qaEnv();
  if (!inboxUrl.includes("/cdn-cgi/local/explorer/")) {
    throw new Error(
      "STUB inbox: only the local Miniflare explorer is supported until the QA infrastructure PR lands"
    );
  }
  return inboxUrl;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`inbox ${response.status} for ${url}`);
  return ((await response.json()) as { result: T }).result;
}

function addressOf(recipient: string): string {
  return (/<([^>]+)>/.exec(recipient)?.[1] ?? recipient).trim().toLowerCase();
}

export function linksOf(text: string, html: string): string[] {
  const found = [
    ...[...html.matchAll(/href="([^"]+)"/g)].map((match) =>
      (match[1] ?? "").replaceAll("&amp;", "&")
    ),
    ...(text.match(/https?:\/\/[^\s<>"')]+/g) ?? []),
  ].filter((link) => /^https?:\/\//.test(link));
  return [...new Set(found)];
}

function matches(subject: string, wanted: string | RegExp | undefined) {
  if (wanted === undefined) return true;
  return typeof wanted === "string" ? subject === wanted : wanted.test(subject);
}

async function newest(query: WaitForMail): Promise<Mail | null> {
  const base = explorer();
  const to = query.to.toLowerCase();
  const since = Math.max(
    new Date(query.since).getTime(),
    clearedAt.get(to) ?? 0
  );
  const items = await getJson<ExplorerItem[]>(`${base}?per_page=100`);
  const hit = items
    .filter(
      (item) =>
        item.to.some((recipient) => addressOf(recipient) === to) &&
        matches(item.subject, query.subject) &&
        new Date(item.sentAt).getTime() >= since
    )
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
  if (!hit) return null;
  const detail = await getJson<ExplorerDetail>(
    `${base}?email_id=${encodeURIComponent(hit.messageId)}`
  );
  const text = detail.text ?? "";
  const html = detail.html ?? "";
  return {
    subject: detail.subject,
    from: detail.from,
    text,
    html,
    headers: detail.headers ?? {},
    links: linksOf(text, html),
  };
}

export const inbox = {
  /** The newest matching mail; polls the inbox until it arrives or the time is up. */
  async waitFor(query: WaitForMail): Promise<Mail> {
    const deadline = Date.now() + query.timeoutMs;
    for (;;) {
      const mail = await newest(query);
      if (mail) return mail;
      if (Date.now() > deadline) {
        throw new Error(
          `no mail to ${query.to}${query.subject ? ` with subject ${query.subject}` : ""} within ${query.timeoutMs} ms`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  },
  /** Forgets everything `to` received until now. */
  async clear(to: string): Promise<void> {
    clearedAt.set(to.toLowerCase(), Date.now());
  },
};
