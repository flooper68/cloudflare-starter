/**
 * `POST /api/site-events`: the public pages' anonymous analytics (src/lib/site-analytics.ts
 * sends them with navigator.sendBeacon). A batch of up to 10 `site: true` events of the
 * catalog (a page view, a click, a scroll mark, a sign-up attempt), written to Analytics
 * Engine with no user, no workspace, no IP and no cookie read. Limited per IP
 * (`site.events`), at most 8 KiB, same-origin only; automated browsers and crawlers are
 * answered and not counted. docs/reference/product-analytics.md#site-events
 */
import {
  analyticsEvents,
  InvalidAnalyticsEventError,
  type RequestContext,
  siteBatchSchema,
  trackSiteEvents,
} from "@cloudflare-starter/features";

import { readLimited } from "@/server/csp-report";
import type { AppEnv } from "@/server/env";
import { problemResponse, withHeaders } from "@/server/http";
import { buildPlatform } from "@/server/platform";
import { rateLimitPolicyHeader } from "@/server/rate-limit-headers";
import {
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

/** Where the public pages send their events (src/lib/site-analytics.ts). */
export const SITE_EVENTS_PATH = "/api/site-events";

/** One batch is well under 2 KiB; larger bodies are refused unread. */
export const SITE_EVENTS_MAX_BYTES = 8 * 1024;

/** sendBeacon sends a string as text/plain; JSON is accepted too. */
const ACCEPTED_TYPES = ["text/plain", "application/json"];

/**
 * User agents that are not a person reading the page: crawlers, link previews, monitors
 * and automated browsers (the QA and E2E suites run headless Chromium). Their events are
 * dropped, so the funnel counts people. The page also stops automated browsers from
 * sending (navigator.webdriver).
 */
export const NON_HUMAN_AGENT =
  /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl\/|wget|python-|go-http|node-fetch|axios|playwright|puppeteer|phantomjs/i;

const limited = { "RateLimit-Policy": rateLimitPolicyHeader(["site.events"]) };

/** Whether the request comes from a page of this origin (or a browser that says nothing). */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

/** POST /api/site-events: 204 once tracked (or dropped as non-human), 4xx otherwise. */
export async function handleSiteEvents(
  request: Request,
  env: AppEnv,
  context: RequestContext
): Promise<Response> {
  const platform = buildPlatform(env);
  const refused = await refuseOverLimit(
    platform,
    "site.events",
    { userId: null, ip: context.ip },
    (error) =>
      rateLimitedResponse(error, context, new URL(request.url).pathname)
  );
  if (refused) return refused;

  if (!isSameOrigin(request)) {
    return withHeaders(
      problemResponse(403, "Forbidden", "Send site events from this site."),
      limited
    );
  }
  const type = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  if (!type || !ACCEPTED_TYPES.includes(type)) {
    return withHeaders(
      problemResponse(
        415,
        "Unsupported Media Type",
        "Send the batch as text/plain or application/json."
      ),
      limited
    );
  }
  const raw = await readLimited(request, SITE_EVENTS_MAX_BYTES);
  if (raw === null) {
    return withHeaders(
      problemResponse(
        413,
        "Content Too Large",
        `A batch may be at most ${SITE_EVENTS_MAX_BYTES} bytes.`
      ),
      limited
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return withHeaders(
      problemResponse(400, "Bad Request", "The body is not JSON."),
      limited
    );
  }
  const batch = siteBatchSchema.safeParse(body);
  if (!batch.success) {
    return withHeaders(
      problemResponse(
        400,
        "Bad Request",
        "Send { events: [{ event, properties }] } with 1 to 10 events."
      ),
      limited
    );
  }
  if (NON_HUMAN_AGENT.test(request.headers.get("user-agent") ?? "")) {
    return new Response(null, { status: 204, headers: limited });
  }
  try {
    trackSiteEvents({ analytics: platform.productAnalytics() }, context, {
      catalog: analyticsEvents,
      batch: batch.data,
    });
  } catch (error) {
    if (error instanceof InvalidAnalyticsEventError) {
      return withHeaders(
        problemResponse(400, "Bad Request", error.message),
        limited
      );
    }
    throw error;
  }
  return new Response(null, { status: 204, headers: limited });
}
