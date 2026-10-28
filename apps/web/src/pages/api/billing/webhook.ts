import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

import { handleBillingWebhook } from "@/server/billing-webhook";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";
import {
  rateLimitedResponse,
  refuseOverLimit,
} from "@/server/rate-limited-response";

/**
 * The billing provider's webhook; 404 unless BILLING=provider (server/billing-webhook.ts).
 * Limited per IP by `billing.webhook` before the signature is checked.
 */
export const POST: APIRoute = async ({ locals, request, url }) => {
  const refused = await refuseOverLimit(
    buildPlatform(env as AppEnv),
    "billing.webhook",
    { userId: null, ip: locals.requestContext.ip },
    (error) => rateLimitedResponse(error, locals.requestContext, url.pathname)
  );
  if (refused) return refused;
  return handleBillingWebhook(request, env as AppEnv, locals.requestContext);
};
