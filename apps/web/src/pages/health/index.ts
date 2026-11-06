import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import type { AppEnv } from "@/server/env";
import { healthResponse } from "@/server/health";

/**
 * `/health`: an alias of `/health/ready`, the URL most uptime monitors and status pages
 * try first. Public, limited by health.ip (server/health.ts).
 */
export const GET: APIRoute = ({ request, locals }) =>
  healthResponse("ready", request, env as AppEnv, locals.requestContext);

export const HEAD = GET;
