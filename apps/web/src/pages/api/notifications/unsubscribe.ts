import { env } from "cloudflare:workers";
import {
  InvalidUnsubscribeTokenError,
  notificationCatalog,
  randomIds,
  systemClock,
  unsubscribe,
} from "@cloudflare-starter/features";
import type { APIRoute } from "astro";

import { buildRequiredConfig } from "@/lib/env";
import { getDb } from "@/server/db";
import {
  httpAttributes,
  internalErrorResponse,
  problemResponse,
} from "@/server/http";
import { buildPlatform } from "@/server/platform";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import {
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

/** The confirmation page a GET (a person, or a link scanner) is sent to. */
const UNSUBSCRIBE_PAGE = "/unsubscribe";

/** The body RFC 8058 requires of a one-click unsubscribe POST. */
const ONE_CLICK_BODY = "List-Unsubscribe=One-Click";

const limited = {
  "RateLimit-Policy": rateLimitPolicyHeader(["notifications.unsubscribe"]),
};

/**
 * GET: never unsubscribes (link scanners and previews open links); redirects to the
 * confirmation page with the same token.
 */
export const GET: APIRoute = ({ url }) => {
  const token = url.searchParams.get("t") ?? "";
  return new Response(null, {
    status: 303,
    headers: {
      location: `${UNSUBSCRIBE_PAGE}?t=${encodeURIComponent(token)}`,
      "cache-control": "no-store",
    },
  });
};

/**
 * One-click unsubscribe (RFC 8058): the mail client, or the confirmation page, POSTs
 * `List-Unsubscribe=One-Click` to the URL of the mail's `List-Unsubscribe` header. The
 * signed token (`?t=`) is the authorization; there is no session.
 *
 * No Origin check, on purpose: mail providers send this POST from their own servers, with
 * no or a foreign Origin, and nothing here relies on cookies, so a cross-site request can
 * do no more than the token already allows. Limited per IP (notifications.unsubscribe).
 */
export const POST: APIRoute = async ({ request, url, locals }) => {
  const refused = await refuseOverLimit(
    buildPlatform(env),
    "notifications.unsubscribe",
    { userId: null, ip: locals.requestContext.ip },
    (error) => rateLimitedResponse(error, locals.requestContext, url.pathname)
  );
  if (refused) return refused;

  const body = await request.text();
  if (new URLSearchParams(body).get("List-Unsubscribe") !== "One-Click") {
    return problemResponse(
      400,
      "Bad Request",
      `The body must be "${ONE_CLICK_BODY}" (RFC 8058).`
    );
  }

  const config = buildRequiredConfig(env);
  try {
    const result = await unsubscribe(
      {
        db: getDb(env),
        clock: systemClock,
        ids: randomIds,
        requestContext: locals.requestContext,
        catalog: notificationCatalog,
        secret: config.BETTER_AUTH_SECRET,
      },
      { token: url.searchParams.get("t") ?? "" }
    );
    return Response.json(
      { unsubscribed: true, types: result.types },
      { headers: { ...limited, "cache-control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof InvalidUnsubscribeTokenError) {
      return problemResponse(400, "Bad Request", error.message, {
        code: InvalidUnsubscribeTokenError.CODE,
      });
    }
    return internalErrorResponse(env, error, locals.requestContext, {
      ...httpAttributes(request),
      "http.route": "/api/notifications/unsubscribe",
    });
  }
};
