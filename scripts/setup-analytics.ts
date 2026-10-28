/**
 * `bun run setup:analytics [--env develop|staging|production|all] [--dry-run]`
 *
 * Asks whether each environment collects analytics and writes the answers as vars into
 * apps/web/wrangler.jsonc (none of them is a secret):
 *  - ANALYTICS: analytics-engine (product events to the ANALYTICS_EVENTS dataset) | none
 *  - WEB_ANALYTICS: cloudflare (cookieless Web Analytics beacon on every page) | none
 *  - WEB_ANALYTICS_TOKEN: the Web Analytics site token, with WEB_ANALYTICS=cloudflare
 * Press Enter to keep the current value. ANALYTICS=analytics-engine also needs the
 * ANALYTICS_ID_SECRET secret (bun run setup:secrets --env <env>). Deploy afterwards.
 * docs/guides/how-to-setup-product-analytics.md
 */
import { parseArgs } from "node:util";

import {
  ask,
  envBlock,
  envPath,
  fail,
  parseEnvironments,
  readWranglerConfig,
  setWranglerValue,
} from "./lib";

const { values } = parseArgs({
  options: {
    env: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] ?? false;
const environments = parseEnvironments(values.env);

/** The allowed values, as apps/web/src/lib/config.ts parseAnalyticsConfig checks them. */
const ANALYTICS = ["analytics-engine", "none"];
const WEB_ANALYTICS = ["cloudflare", "none"];

const config = readWranglerConfig();
for (const env of environments) {
  const vars = (envBlock(config, env).vars ?? {}) as Record<string, string>;
  console.log(`\nAnalytics for ${env}:`);
  const answer = async (name: string, prompt: string) => {
    const current = vars[name] ?? "";
    const given = dryRun
      ? ""
      : await ask(`${name}: ${prompt} [${current}]\n> `);
    // "-" clears an optional value; Enter keeps the current one.
    return given === "-" ? "" : given || current;
  };

  const analytics = await answer(
    "ANALYTICS",
    "Product events: analytics-engine (Workers Analytics Engine, pseudonymous) or none"
  );
  const webAnalytics = await answer(
    "WEB_ANALYTICS",
    "Page views and Web Vitals: cloudflare (Web Analytics, cookieless beacon) or none"
  );
  const token =
    webAnalytics === "cloudflare"
      ? await answer(
          "WEB_ANALYTICS_TOKEN",
          "Web Analytics site token (dashboard > Analytics & Logs > Web Analytics > Add a site > the token in the JS snippet)"
        )
      : "";

  if (dryRun && !analytics && !webAnalytics) {
    console.log(
      `  (dry run) ${env}: ANALYTICS and WEB_ANALYTICS are not set yet; the real run asks for them`
    );
    continue;
  }
  if (!ANALYTICS.includes(analytics))
    fail(`${env}: ANALYTICS must be ${ANALYTICS.join(" or ")}`);
  if (!WEB_ANALYTICS.includes(webAnalytics))
    fail(`${env}: WEB_ANALYTICS must be ${WEB_ANALYTICS.join(" or ")}`);
  if (webAnalytics === "cloudflare" && !token)
    fail(`${env}: WEB_ANALYTICS=cloudflare needs WEB_ANALYTICS_TOKEN`);

  setWranglerValue(envPath(env, "vars", "ANALYTICS"), analytics, dryRun);
  setWranglerValue(envPath(env, "vars", "WEB_ANALYTICS"), webAnalytics, dryRun);
  setWranglerValue(envPath(env, "vars", "WEB_ANALYTICS_TOKEN"), token, dryRun);
  console.log(
    `✓ ${env}: ANALYTICS=${analytics}, WEB_ANALYTICS=${webAnalytics}${dryRun ? " (dry run)" : ""}`
  );
  if (analytics === "analytics-engine")
    console.log(
      `  ANALYTICS=analytics-engine needs the ANALYTICS_ID_SECRET Worker secret: bun run setup:secrets --env ${env}`
    );
}

console.log(
  dryRun
    ? "\nDry run: nothing was changed."
    : "\nNext: deploy each environment for the settings to take effect (docs/guides/how-to-setup-product-analytics.md)."
);
