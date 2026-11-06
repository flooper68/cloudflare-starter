import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import type { AppEnv } from "@/server/env";
import { healthResponse } from "@/server/health";

/**
 * Liveness: 200 `{"status":"pass"}` while the Worker runs; touches no dependency. Public,
 * limited by health.ip (server/health.ts).
 */
export const GET: APIRoute = ({ request, locals }) =>
  healthResponse("live", request, env as AppEnv, locals.requestContext);

export const HEAD = GET;
