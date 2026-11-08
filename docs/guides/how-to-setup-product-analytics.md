# How to set up product analytics

::reviewed{date="2026-11-09"}

The app records what people do (an account created, a workspace created, a file uploaded, a page shown) as product events under pseudonymous ids, with no names, emails or IP addresses, and can add Cloudflare's cookieless page views. The app only writes: you query the data outside it, with SQL or Grafana. Every event: [Catalogs › Product analytics events](../reference/catalogs.md#product-analytics-events).

::flow[Use case or screen -> trackEvent -> Analytics Engine -> SQL or Grafana]{title="Product analytics: a use case or a screen tracks an event, it is written to Analytics Engine, you query it outside the app"}

## Set up an environment

:::settings
- ANALYTICS = analytics-engine (analytics-engine | none) Product events
- WEB_ANALYTICS = none (cloudflare | none) Cookieless page views and Web Vitals
  :::

No choice is shipped for deployed environments: collecting analytics is your decision, and the Worker refuses to start until you make it.

:::prompt{title="Paste this into your coding agent"}
```text
Turn on product analytics for production: run `bun run setup:analytics --env production
--dry-run`, show me the plan, then run it, set ANALYTICS_ID_SECRET with setup:secrets,
and run doctor.
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

## Add an event

:::steps
1. **Declare it** in the owning feature's `domain/analytics-events.ts` with `defineEvent(name, layout, schema, { client, description })`.
2. **Register it** in `packages/features/src/analytics-events.ts`.
3. **Track it** after the change succeeded: `trackEvent(deps, context, event, props)` on the server, or `trackClientEvent(name, props)` in the app for a screen event.
4. **Test it** with the memory adapter; the architecture test fails on an event that is declared but not registered or tracked.
   :::

:::decision{title="Write-only on purpose"}
There is no analytics screen, reader or query token in the app, so a compromised app cannot read its users' behaviour back.
:::

## Reference

What is wired up, the rules, the Segment mapping, privacy and erasure, the data-point layout, sampling, querying, Web Analytics, another vendor and troubleshooting: [Product analytics reference](../reference/product-analytics.md).
