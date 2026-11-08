import { env } from "cloudflare:workers";
import {
  clearQaMail,
  isQaAdminEmail,
  isQaRunAddress,
  listQaMail,
  type QaBypassSettings,
  systemClock,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";

import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import { problemResponse } from "@/server/http";
import { QA_ENDPOINT_HEADERS, qaEndpoint } from "@/server/qa-endpoint";

const ROUTE = "/api/qa/outbox";

/**
 * The address a request names, if the outbox serves it: a run address
 * `qa+<runId>-<role>@<QA_EMAIL_DOMAIN>`, or the QA admin's `qa+admin@` (the QA suite's
 * global setup verifies it; the token that reads it also derives its password, so reading
 * its mail grants nothing more). Never any other address.
 */
function servedAddress(url: URL, bypass: QaBypassSettings): string | null {
  const to = url.searchParams.get("to")?.trim().toLowerCase() ?? "";
  return isQaRunAddress(to, bypass.emailDomain) ||
    isQaAdminEmail(to, bypass.emailDomain)
    ? to
    : null;
}

function badAddress(bypass: QaBypassSettings): Response {
  return problemResponse(
    400,
    "Bad Request",
    `to must be a QA run address qa+<runId>-<role>@${bypass.emailDomain} or qa+admin@${bypass.emailDomain}.`
  );
}

/**
 * The QA outbox (QA_BYPASS=on only; 404 otherwise): mail the app kept instead of sending
 * to QA addresses. Gate: server/qa-endpoint.ts (QA token, `qa.bypass`).
 * - `GET ?to=<address>&since=<iso>&subject=<substring>`: `{ messages }`, newest first.
 * - `DELETE ?to=<address>`: `{ deleted }`.
 */
export const GET: APIRoute = (context) =>
  qaEndpoint(env as AppEnv, context, ROUTE, "qa.bypass", async (bypass) => {
    const to = servedAddress(context.url, bypass);
    if (!to) return badAddress(bypass);
    const sinceParam = context.url.searchParams.get("since");
    const since = sinceParam === null ? null : new Date(sinceParam);
    if (since && Number.isNaN(since.getTime())) {
      return problemResponse(
        400,
        "Bad Request",
        "since must be an ISO 8601 time."
      );
    }
    const messages = await listQaMail(
      { db: getDb(env as AppEnv), clock: systemClock },
      { to, since, subject: context.url.searchParams.get("subject") || null }
    );
    return Response.json({ messages }, { headers: QA_ENDPOINT_HEADERS });
  });

export const DELETE: APIRoute = (context) =>
  qaEndpoint(env as AppEnv, context, ROUTE, "qa.bypass", async (bypass) => {
    const to = servedAddress(context.url, bypass);
    if (!to) return badAddress(bypass);
    const { deleted } = await clearQaMail({ db: getDb(env as AppEnv) }, { to });
    return Response.json({ deleted }, { headers: QA_ENDPOINT_HEADERS });
  });
