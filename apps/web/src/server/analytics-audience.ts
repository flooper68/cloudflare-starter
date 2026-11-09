/**
 * Who product analytics leave out, so the funnel counts the people it is about: the
 * bootstrap admin, sessions an admin is impersonating, and in the starter's own instance
 * the automated QA suite's accounts (@QA_EMAIL_DOMAIN) and the accounts demo mode protects
 * (DEMO_PROTECTED_EMAILS). Their requests get the noop adapter, so nothing they do is
 * written (and no funnel milestone is recorded). Anonymous site events have no account:
 * automated browsers are dropped there instead (server/site-events.ts).
 * docs/reference/product-analytics.md#who-is-left-out
 */
import {
  noopProductAnalytics,
  type ProductAnalytics,
} from "@cloudflare-starter/features";

import { buildRawEnv } from "@/lib/env";
import type { AppEnv } from "@/server/env";
import { buildPlatform } from "@/server/platform";

function emails(list: string | undefined): string[] {
  return (list ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether a signed-in person's actions stay out of product analytics. */
export function isExcludedFromAnalytics(
  env: AppEnv,
  who: { readonly email: string | null; readonly impersonated?: boolean }
): boolean {
  if (who.impersonated) return true;
  const email = who.email?.trim().toLowerCase();
  if (!email) return false;
  const raw = buildRawEnv(env);
  const excluded = new Set(emails(raw.BOOTSTRAP_ADMIN_EMAIL));
  const domains: string[] = [];
  // The starter's own instance: its QA accounts and demo mode's protected accounts.
  if (raw.QA_EMAIL_DOMAIN) domains.push(raw.QA_EMAIL_DOMAIN.toLowerCase());
  for (const protectedEmail of emails(raw.DEMO_PROTECTED_EMAILS))
    excluded.add(protectedEmail);
  return (
    excluded.has(email) ||
    domains.some((domain) => email.endsWith(`@${domain}`))
  );
}

/** The ProductAnalytics of one unit of work for this person: noop when they are left out. */
export function productAnalyticsFor(
  env: AppEnv,
  who: { readonly email: string | null; readonly impersonated?: boolean }
): ProductAnalytics {
  return isExcludedFromAnalytics(env, who)
    ? noopProductAnalytics
    : buildPlatform(env).productAnalytics();
}
