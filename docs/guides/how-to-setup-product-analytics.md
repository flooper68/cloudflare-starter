# How to set up product analytics

::reviewed{date="2026-11-09"}

The app records what people do as product events in Workers Analytics Engine: pseudonymous ids for signed-in people, anonymous events from the public pages, no names, emails, IP addresses or cookies, so no consent banner. Admins read the funnel back on the Analytics page of the admin portal; Cloudflare's cookieless Web Analytics can add page views and Web Vitals. Every event: [Catalogs › Product analytics events](../reference/catalogs.md#product-analytics-events).

::flow[Public pages and the app -> trackEvent / trackSiteEvent -> Analytics Engine -> Admin › Analytics, SQL, Grafana]{title="Product analytics: the pages and the app track events, Analytics Engine stores them, the admin portal and SQL read them"}

## Set up an environment

:::settings
- ANALYTICS = analytics-engine (analytics-engine | none) Product events, the app's and the public pages'
- WEB_ANALYTICS = none (cloudflare | none) Cookieless page views and Web Vitals (the beacon)
- ANALYTICS_READ_TOKEN = (secret, optional) Lets the admin portal read the events back
  :::

No choice is shipped for deployed environments: collecting analytics is your decision, and the Worker refuses to start until you make it.

:::prompt{title="Paste this into your coding agent"}
```text
Turn on product analytics for production: run `bun run setup:analytics --env production
--dry-run`, show me the plan, then run it, set ANALYTICS_ID_SECRET with setup:secrets,
and run doctor. Then tell me what to create in the Cloudflare dashboard for the admin
Analytics page (the read token) and for Web Analytics (the site and its token).
```
:::

:::byhand
1. `bun run setup:analytics --env <env>` writes `ANALYTICS`, `WEB_ANALYTICS` and, with web analytics on, `WEB_ANALYTICS_TOKEN` into `wrangler.jsonc`.
2. With `ANALYTICS=analytics-engine`: `bun run setup:secrets --env <env>` stores `ANALYTICS_ID_SECRET`.
3. `bun run doctor`, then deploy. The dataset appears on its first write.
   :::

:::gotcha{title="Keep ANALYTICS_ID_SECRET"}
Rotating it starts every pseudonymous id afresh, so old and new data no longer join.
:::

## Read the funnel in the admin portal

:::steps
1. **Create a read token.** Cloudflare dashboard › My Profile › API Tokens › Create custom token: permission **Account › Account Analytics › Read**, this account only, nothing else.
2. **Store it.** `bun run setup:secrets --env <env>` asks for `ANALYTICS_READ_TOKEN` and `ANALYTICS_ACCOUNT_ID` (the 32-character account id).
3. **Optional: Web Analytics.** Set the var `WEB_ANALYTICS_SITE_TAG` (the site tag in the Web Analytics dashboard's URL) to add its visits and referrers; the same token reads them.
4. **Open Admin › Analytics** (`/admin/analytics`, or `admin_get_analytics` over MCP): the funnel for 24 hours, 7 or 30 days.
   :::

The funnel: **visit → got the pitch → clicked a call to action → started sign-up → signed up → tried a feature → tried 3+ → came back within 7 days**. The public steps count visits (entry page views; there is no visitor id, by design), sign-up counts attempts, and from sign-up on the steps count people; each step shows its share of the one above, at most 100 %. Below it: where visits come from, scroll depth, videos, the feature map and docs sections, calls to action, sign-up failures by reason, features ranked by the people who tried them, the first feature and the median time to it, and server errors and latency per route.

:::decision{title="Read back, only by admins"}
The read token is a separate, optional secret that only the admin portal uses, behind the admin role and the portal's second-factor rules; the app's write path never holds it. Without it the page says which settings to set.
:::

## Turn on Web Analytics

:::steps
1. **Add the site.** Dashboard › Analytics & Logs › Web Analytics › Add a site › the environment's hostname › copy the token from the JS snippet. Leave automatic setup alone: HTML is sent `no-transform`, so the edge injects nothing.
2. **Set it.** `bun run setup:analytics --env <env>`: `WEB_ANALYTICS=cloudflare` and `WEB_ANALYTICS_TOKEN`.
3. **Deploy.** Every page loads the beacon itself; the page policy allows exactly that script and its report endpoint.
   :::

## Add an event

:::steps
1. **Declare it** in the owning feature's `domain/analytics-events.ts` with `defineEvent(name, layout, schema, { client, site, description })`.
2. **Register it** in `packages/features/src/analytics-events.ts`.
3. **Track it** after the change succeeded: `trackEvent(deps, context, event, props)` on the server, `trackClientEvent(name, props)` in the app, `trackSiteEvent(name, props)` on a public page.
4. **Test it** with the memory adapter; the architecture test fails on an event that is declared but not registered or tracked.
   :::

A new feature people can try: add it to `TRIED_FEATURES` and a trigger (`FEATURE_TRIAL_PROCEDURES`, a client event or an auth path) in `product-analytics/domain/feature-trials.ts`.

Who is left out of the funnel: the bootstrap admin and sessions an admin is impersonating (`apps/web/src/server/analytics-audience.ts`), and automated browsers on the public pages. The landing page's calls to action (`data-track-cta`) and the feature map's event go with the landing page you replace.

> **Starter-only, removed by `starter:strip`** (`qa-automation`): the starter also leaves its QA suite's accounts (`@QA_EMAIL_DOMAIN`) out of the funnel.

> **Starter-only, removed by `starter:strip`** (`demo-mode`): the starter also leaves the accounts demo mode protects (`DEMO_PROTECTED_EMAILS`) out of the funnel.

## Reference

What is wired up, the rules, site events, the funnel and its queries, who is left out, privacy and retention, the data-point layout, sampling, querying with SQL or Grafana, Web Analytics and troubleshooting: [Product analytics reference](../reference/product-analytics.md).
