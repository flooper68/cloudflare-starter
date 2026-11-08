import { env } from "cloudflare:workers";
import {
  clearQaMail,
  isQaRunAddress,
  listQaMail,
  QA_TOKEN_HEADER,
  systemClock,
  timingSafeEqual,
} from "@cloudflare-starter/features";
import type { APIContext, APIRoute } from "astro";

import { getDb } from "@/server/db";
import {
  httpAttributes,
  internalErrorResponse,
  problemResponse,
} from "@/server/http";
import { buildPlatform, loggerFor } from "@/server/platform";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import {
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

const ROUTE = "/api/qa/outbox";
const headers = {
  "RateLimit-Policy": rateLimitPolicyHeader(["qa.bypass"]),
  "cache-control": "no-store",
};

/**
 * The QA outbox for the automated QA suite (QA_BYPASS=on only; 404 otherwise, as if it did
 * not exist): mail the app kept instead of sending to QA addresses.
 * - `GET ?to=<address>&since=<iso>&subject=<substring>`: `{ messages }`, newest first.
 * - `DELETE ?to=<address>`: `{ deleted }`.
 * Authorized by `X-QA-Token` (QA_TOKEN, constant-time compare), not a session; every
 * request is counted against `qa.bypass` per IP before the token is compared. `to` must be
 * a run address `qa+<runId>-<role>@<QA_EMAIL_DOMAIN>`. No Origin check, on purpose: no
 * cookie authorizes anything here, so a cross-site request can do no more than the token.
 */
async function handle(
  context: APIContext,
  run: (to: string) => Promise<Response>
): Promise<Response> {
  const { request, url, locals } = context;
  const platform = buildPlatform(env);
  if (!platform.qaBypass) return new Response("Not Found", { status: 404 });
  const refused = await refuseOverLimit(
    platform,
    "qa.bypass",
    { userId: null, ip: locals.requestContext.ip },
    (error) => rateLimitedResponse(error, locals.requestContext, url.pathname)
  );
  if (refused) return refused;
  const presented = request.headers.get(QA_TOKEN_HEADER) ?? "";
  if (!timingSafeEqual(presented, platform.qaBypass.token)) {
    loggerFor(platform, locals.requestContext).warn("qa.outbox.refused", {
      "app.qa_bypass.reason": presented ? "wrong_token" : "missing_token",
    });
    return problemResponse(
      401,
      "Unauthorized",
      "The QA token is missing or wrong."
    );
  }
  const to = url.searchParams.get("to")?.trim().toLowerCase() ?? "";
  if (!isQaRunAddress(to, platform.qaBypass.emailDomain)) {
    return problemResponse(
      400,
      "Bad Request",
      `to must be a QA run address qa+<runId>-<role>@${platform.qaBypass.emailDomain}.`
    );
  }
  try {
    return await run(to);
  } catch (error) {
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": ROUTE,
    });
  }
}

export const GET: APIRoute = (context) =>
  handle(context, async (to) => {
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
      { db: getDb(env), clock: systemClock },
      {
        to,
        since,
        subject: context.url.searchParams.get("subject") || null,
      }
    );
    return Response.json({ messages }, { headers });
  });

export const DELETE: APIRoute = (context) =>
  handle(context, async (to) => {
    const { deleted } = await clearQaMail({ db: getDb(env) }, { to });
    return Response.json({ deleted }, { headers });
  });
