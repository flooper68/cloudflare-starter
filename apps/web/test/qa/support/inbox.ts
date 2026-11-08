import { type QaEnv, qaEnv } from "./env";
import { extractLinks } from "./links";

/** A mail the QA inbox received, as `inbox.waitFor` returns it. */
export interface QaMail {
  readonly subject: string;
  readonly from: string;
  readonly text: string;
  readonly html: string;
  /** Lowercase header names, e.g. `list-unsubscribe`, `list-unsubscribe-post`. */
  readonly headers: Readonly<Record<string, string>>;
  /** Every http(s) link in the HTML and the text, deduplicated. */
  readonly links: string[];
}

/** One message of the inbox API (apps/qa-inbox/src/store.ts InboxMessage). */
interface InboxMessage {
  readonly subject: string;
  readonly from: string;
  readonly text: string | null;
  readonly html: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly receivedAt: string;
}

export interface WaitForMail {
  /** The QA address, e.g. from `qaAddress(runId, "owner")`. */
  readonly to: string;
  /** A case-insensitive part of the subject. */
  readonly subject?: string;
  /** Only mail received at or after this time (take it just before the action). */
  readonly since: Date;
  /** Default 90 s: delivery through Email Routing usually takes a few seconds. */
  readonly timeoutMs?: number;
}

const POLL_MS = 2_000;

async function call(
  env: QaEnv,
  method: "GET" | "DELETE",
  query: URLSearchParams
): Promise<unknown> {
  const response = await fetch(`${env.inboxURL}/messages?${query}`, {
    method,
    headers: { authorization: `Bearer ${env.inboxToken}` },
  });
  if (!response.ok) {
    throw new Error(
      `QA inbox ${method} /messages answered ${response.status}${response.status === 401 ? " (check QA_INBOX_TOKEN)" : ""}`
    );
  }
  return response.json();
}

/** The QA inbox API (apps/qa-inbox), with the URL and token from `qaEnv()`. */
export const inbox = {
  /**
   * The newest mail to `to` received since `since` (and whose subject contains `subject`),
   * polling until `timeoutMs`. Throws when none arrives in time.
   */
  async waitFor(options: WaitForMail): Promise<QaMail> {
    const env = qaEnv();
    const timeoutMs = options.timeoutMs ?? 90_000;
    const deadline = Date.now() + timeoutMs;
    const query = new URLSearchParams({
      to: options.to,
      since: options.since.toISOString(),
    });
    if (options.subject) query.set("subject", options.subject);
    for (;;) {
      const { messages } = (await call(env, "GET", query)) as {
        messages: InboxMessage[];
      };
      const newest = messages[0];
      if (newest) {
        return {
          subject: newest.subject,
          from: newest.from,
          text: newest.text ?? "",
          html: newest.html ?? "",
          headers: newest.headers,
          links: extractLinks(newest.text, newest.html),
        };
      }
      if (Date.now() + POLL_MS > deadline) {
        throw new Error(
          `no mail to ${options.to}${options.subject ? ` with "${options.subject}" in the subject` : ""} since ${options.since.toISOString()} within ${Math.round(timeoutMs / 1000)} s`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  },

  /** Deletes every mail to `to`; returns how many. */
  async clear(to: string): Promise<number> {
    const { deleted } = (await call(
      qaEnv(),
      "DELETE",
      new URLSearchParams({ to })
    )) as { deleted: number };
    return deleted;
  },
};
