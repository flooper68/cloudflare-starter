import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import type { AppEnv } from "@/server/env";
import { healthResponse } from "@/server/health";

/**
 * Readiness: every dependency checked with a deadline, in the IETF health check format;
 * 200 for pass and warn, 503 for fail. Public, limited by health.ip (server/health.ts).
 */
export const GET: APIRoute = ({ request, locals }) =>
  healthResponse("ready", request, env as AppEnv, locals.requestContext);

export const HEAD = GET;
