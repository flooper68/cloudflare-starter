import { type QaEnv, qaEnv } from "./env";
import { takeSlots } from "./limits";
import { extractLinks } from "./links";
import { QA_TOKEN_HEADER } from "./routing";

/** The app's QA outbox (apps/web/src/pages/api/qa/outbox.ts). */
const OUTBOX_PATH = "/api/qa/outbox";

/**
 * A mail the app kept in its QA outbox instead of sending (QA_BYPASS=on), as
 * `inbox.waitFor` returns it.
 */
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

/** One message of GET /api/qa/outbox (packages/features/src/qa-outbox QaMail). */
interface InboxMessage {
  readonly subject: string;
  readonly from: string;
  readonly text: string;
  readonly html: string;
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
  /** Default 90 s: the outbox has the mail as soon as the app would have sent it. */
  readonly timeoutMs?: number;
}

/**
 * Between polls. Every read counts against `qa.bypass` (30 a minute per IP, shared with
 * the run's sign-ups and sign-ins), so a long wait stays well under it.
 */
const POLL_MS = 5_000;

async function call(
  env: QaEnv,
  method: "GET" | "DELETE",
  query: URLSearchParams
): Promise<unknown> {
  // Shares `qa.bypass` with the run's sign-ups and sign-ins (limits.ts paces them all).
  await takeSlots(["qa.bypass"]);
  let response = await fetch(`${env.baseURL}${OUTBOX_PATH}?${query}`, {
    method,
    headers: { [QA_TOKEN_HEADER]: env.token },
  });
  // Over the qa.bypass limit: wait as long as the app says, once, then ask again.
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after")) || 60;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    response = await fetch(`${env.baseURL}${OUTBOX_PATH}?${query}`, {
      method,
      headers: { [QA_TOKEN_HEADER]: env.token },
    });
  }
  if (!response.ok) {
    throw new Error(
      `QA outbox ${method} ${OUTBOX_PATH} answered ${response.status}${
        response.status === 401
          ? " (QA_TOKEN differs from the app's secret)"
          : response.status === 404
            ? " (QA_BYPASS is off for this environment)"
            : ""
      }`
    );
  }
  return response.json();
}

/** The app's QA outbox, read with QA_BASE_URL and QA_TOKEN from `qaEnv()`. */
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
