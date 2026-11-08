import { isAuthorized } from "./auth";
import type { InboxEnv } from "./env";
import { inDomain } from "./receive";
import { deleteMessages, findMessages } from "./store";

const MESSAGES_PATH = "/messages";

function json(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

/**
 * The inbox API, bearer-token protected (QA_INBOX_TOKEN), and nothing else: no other
 * route, no CORS (a browser on another origin cannot read it; the QA suite calls it from
 * Node).
 * - `GET /messages?to=<address>&since=<iso>&subject=<substring>`: JSON
 *   `{ messages: [...] }`, newest first, at most 50.
 * - `DELETE /messages?to=<address>`: `{ deleted: <n> }`.
 * `to` is required and must be in QA_EMAIL_DOMAIN.
 */
export async function handleApi(
  request: Request,
  env: InboxEnv,
  now: () => number = Date.now
): Promise<Response> {
  if (!isAuthorized(request, env.QA_INBOX_TOKEN)) {
    return json(
      401,
      { error: "unauthorized" },
      { "www-authenticate": 'Bearer realm="qa-inbox"' }
    );
  }
  const url = new URL(request.url);
  if (url.pathname !== MESSAGES_PATH) {
    return json(404, { error: "not_found" });
  }
  if (request.method !== "GET" && request.method !== "DELETE") {
    return json(405, { error: "method_not_allowed" }, { allow: "GET, DELETE" });
  }
  const to = url.searchParams.get("to")?.trim().toLowerCase() ?? "";
  if (!to || !env.QA_EMAIL_DOMAIN || !inDomain(to, env.QA_EMAIL_DOMAIN)) {
    return json(400, {
      error: "invalid_to",
      detail: `to must be an address @${env.QA_EMAIL_DOMAIN ?? "the QA domain"}`,
    });
  }
  if (request.method === "DELETE") {
    return json(200, { deleted: await deleteMessages(env.INBOX, to) });
  }
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam === null ? null : Date.parse(sinceParam);
  if (since !== null && Number.isNaN(since)) {
    return json(400, {
      error: "invalid_since",
      detail: "since must be an ISO 8601 time",
    });
  }
  const subject = url.searchParams.get("subject") || null;
  const messages = await findMessages(env.INBOX, {
    to,
    since,
    subject,
    now: now(),
  });
  return json(200, { messages });
}
