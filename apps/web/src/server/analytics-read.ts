/**
 * What the admin portal's Analytics page reads from (packages/features getAnalyticsReport):
 * the Cloudflare analytics APIs with the optional ANALYTICS_READ_TOKEN (an account API
 * token with Account Analytics Read) and ANALYTICS_ACCOUNT_ID secrets, the dataset names
 * (ANALYTICS_EVENTS_DATASET, METRICS_DATASET_NAME, the same as the bindings' in
 * wrangler.jsonc) and the Web Analytics site tag (WEB_ANALYTICS_SITE_TAG). Missing or
 * malformed values leave that part out; the page says which setting to set.
 * docs/reference/product-analytics.md#the-analytics-page
 */
import {
  type AnalyticsReadSettings,
  createCloudflareAnalyticsReader,
} from "@cloudflare-starter/features";

import { buildRawEnv } from "@/lib/env";
import type { AppEnv } from "@/server/env";

/** A Cloudflare account id: 32 hex characters. */
const ACCOUNT_ID = /^[0-9a-f]{32}$/;
/** An Analytics Engine dataset name, as wrangler.jsonc accepts it. */
const DATASET = /^[a-z][a-z0-9_]{0,63}$/;
/** A Web Analytics site tag: 32 hex characters. */
const SITE_TAG = /^[0-9a-f]{32}$/;

function matching(value: string | undefined, pattern: RegExp): string | null {
  const trimmed = value?.trim();
  return trimmed && pattern.test(trimmed) ? trimmed : null;
}

/** The settings of this environment; the reader exists only with a token and account id. */
export function analyticsReadSettings(env: AppEnv): AnalyticsReadSettings {
  const raw = buildRawEnv(env);
  const accountId = matching(raw.ANALYTICS_ACCOUNT_ID, ACCOUNT_ID);
  const token = raw.ANALYTICS_READ_TOKEN?.trim() || null;
  return {
    reader:
      accountId && token
        ? createCloudflareAnalyticsReader({
            accountId,
            token,
            // workerd's fetch must not be called as a method of another object.
            fetch: (input, init) => fetch(input, init),
          })
        : null,
    accountId,
    eventsDataset: matching(raw.ANALYTICS_EVENTS_DATASET, DATASET),
    metricsDataset: matching(raw.METRICS_DATASET_NAME, DATASET),
    webAnalyticsSiteTag: matching(raw.WEB_ANALYTICS_SITE_TAG, SITE_TAG),
  };
}
