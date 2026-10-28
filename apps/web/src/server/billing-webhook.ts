/**
 * The billing provider's webhook (`POST /api/billing/webhook`): only with BILLING=provider
 * (404 otherwise). The provider adapter verifies the request (no session, no Origin: the
 * signature is the authentication) and normalizes it; applySubscriptionChange stores it.
 * Errors are Problem Details: 400 for a forged request, 404 for an unknown workspace,
 * 500 with a reference for anything unexpected (the provider retries non-2xx answers).
 * The route limits it per IP first (`billing.webhook`, abuse protection).
 */
import {
  applySubscriptionChange,
  type BillingProvider,
  DomainError,
  type RequestContext,
  randomIds,
  systemClock,
} from "@cloudflare-starter/features";

import { buildRequiredConfig } from "@/lib/env";
import { billingProviderFor } from "@/server/billing-provider";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";
import {
  domainErrorResponse,
  httpAttributes,
  internalErrorResponse,
  problemResponse,
} from "@/server/http";

export async function handleBillingWebhook(
  request: Request,
  env: AppEnv,
  requestContext: RequestContext,
  provider?: BillingProvider
): Promise<Response> {
  if (buildRequiredConfig(env).billing.mode !== "provider") {
    return problemResponse(
      404,
      "Not Found",
      "This environment takes no billing webhooks (BILLING is not provider)."
    );
  }
  try {
    const change = await (provider ?? billingProviderFor(env)).parseWebhook(
      request
    );
    if (!change) return Response.json({ received: true, applied: false });
    const result = await applySubscriptionChange(
      {
        db: getDb(env),
        clock: systemClock,
        ids: randomIds,
        requestContext: { ...requestContext, workspaceId: change.workspaceId },
      },
      change
    );
    return Response.json({ received: true, applied: result.applied });
  } catch (error) {
    if (error instanceof DomainError) return domainErrorResponse(error);
    return internalErrorResponse(env, error, requestContext, {
      ...httpAttributes(request),
      "http.route": "/api/billing/webhook",
    });
  }
}
