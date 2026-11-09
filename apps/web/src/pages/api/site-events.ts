import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import type { AppEnv } from "@/server/env";
import { handleSiteEvents } from "@/server/site-events";

/**
 * Anonymous analytics of the public pages (navigator.sendBeacon from
 * src/lib/site-analytics.ts). Limited per IP by site.events (server/site-events.ts).
 */
export const POST: APIRoute = ({ request, locals }) =>
  handleSiteEvents(request, env as AppEnv, locals.requestContext);
