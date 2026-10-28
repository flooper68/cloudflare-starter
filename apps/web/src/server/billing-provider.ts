/**
 * Composition root of billing: the BillingGate use cases receive and the BillingProvider
 * BILLING selects (docs/guides/how-to-configure-plans-and-billing.md).
 * - off, manual: the noop provider (no checkout, no webhooks).
 * - provider: the project's adapter from `projectBillingProvider` below. The starter ships
 *   none, so BILLING=provider fails every request with an error that says so until one is
 *   registered.
 */
import {
  type BillingGate,
  type BillingProvider,
  createBillingGate,
  noopBillingProvider,
  type RequestContext,
  randomIds,
  systemClock,
} from "@cloudflare-starter/features";

import { ConfigError } from "@/lib/config";
import { buildRequiredConfig } from "@/lib/env";
import { getDb } from "@/server/db";
import type { AppEnv } from "@/server/env";

/**
 * The project's BillingProvider for BILLING=provider: write an adapter in
 * packages/features/src/platform/adapters/<vendor>/ (the guide sketches Stripe) and
 * return it here, built from this environment's secrets. null: none registered.
 */
export function projectBillingProvider(_env: AppEnv): BillingProvider | null {
  return null;
}

/** The provider BILLING selects. Throws a ConfigError for provider mode without an adapter. */
export function billingProviderFor(
  env: AppEnv,
  project: (env: AppEnv) => BillingProvider | null = projectBillingProvider
): BillingProvider {
  if (buildRequiredConfig(env).billing.mode !== "provider")
    return noopBillingProvider;
  const provider = project(env);
  if (!provider) {
    throw new ConfigError(
      "BILLING",
      "BILLING=provider needs a billing provider adapter: register one in apps/web/src/server/billing-provider.ts (docs/guides/how-to-configure-plans-and-billing.md), or set BILLING to off or manual"
    );
  }
  return provider;
}

/** The BillingGate for one unit of work (an HTTP request, an auth hook). */
export function billingGateFor(
  env: AppEnv,
  requestContext: RequestContext
): BillingGate {
  return createBillingGate({
    db: getDb(env),
    clock: systemClock,
    ids: randomIds,
    requestContext,
    settings: buildRequiredConfig(env).billing,
  });
}
