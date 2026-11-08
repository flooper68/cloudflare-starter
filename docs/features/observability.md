# Logs, metrics, health and analytics

::reviewed{date="2026-11-08"}

Know what your app is doing without adding a service: every request and job is logged and measured under one trace id, users quote a short reference instead of a stack trace, health checks answer your uptime monitor, and product analytics count usage without personal data.

::video{id="infra" poster="admin-overview" title="Observability & ops in 60 seconds"}

## Where to find it

::shot{id="admin-overview" alt="The admin overview: counts, health and the database"}

## How it works

::flow[Request or job -> Logs, metrics, trace -> One trace id -> Your dashboard]{title="Observability flow: every request or job writes logs, metrics and a trace that share one trace id"}

:::compare
::before[An error shows the user a stack trace]
::after[The user sees a short reference you can look up in the logs]
:::

- Logs are structured records with a trace id; the same id follows a request into its background jobs.
- Metrics record latency of requests, procedures, jobs and schedules.
- `/health/live` says the app answers; `/health/ready` checks the database and settings, for monitors and status pages.
- Product events use pseudonymous ids: no names, no emails, no IP addresses.

## Turn it on

Each is a setting in `apps/web/wrangler.jsonc`, on by default where it costs nothing:

:::settings
- LOG_SINK = workers-logs (workers-logs | none) Where logs go
- ERROR_REPORTER = workers-logs (workers-logs | none) Where error reports go
- METRICS = analytics-engine (analytics-engine | none) Request, job and schedule metrics
- TRACING = workers (workers | none) Traces across requests and jobs
- ANALYTICS = analytics-engine (analytics-engine | none) Product events, set per environment by `setup:analytics`
- WEB_ANALYTICS = none (cloudflare | none) Cookieless page views

:::

:::prompt{title="Paste this into your coding agent"}
```text
Point an uptime monitor at production: give me the /health/ready URL and the settings
for a 1-minute check, and run `bun run setup:analytics --env production --dry-run`
to show what product analytics would write.
```
:::

## Use it

:::tabs
```bash title="curl"
curl -s https://<your-app>/health/ready
# {"status":"pass","checks":{"d1:responseTime":[{"status":"pass", …}]}}
```
```ts title="Log a line"
ctx.logger.info("files.uploaded", { "app.file.size_bytes": size });
```
```json title="MCP"
{
  "method": "tools/call",
  "params": { "name": "admin_get_health", "arguments": {} }
}
```
:::

:::decision{title="Why /health is readiness, not liveness"}
Whoever points a monitor at `/health` wants to know whether the app works, so `/health` checks the database too.
:::

:::gotcha{title="The 30-day restore is the platform's, not code"}
The database can be rolled back to any minute in the last 30 days with `wrangler d1 time-travel restore`. Re-apply erasures afterwards ([privacy](privacy.md)).
:::

## Limits

- Health endpoints are rate limited (120 a minute per IP) and never cached.
- Traces count against Cloudflare's observability allowance from 1 Dec 2026; sampling keeps them low.

## Related

- [Logging](../guides/how-to-setup-logging.md), [error reporting](../guides/how-to-setup-error-reporting.md), [metrics and tracing](../guides/how-to-setup-metrics-and-tracing.md)
- [Monitor health](../guides/how-to-monitor-health.md)
- [Product analytics](../guides/how-to-setup-product-analytics.md)
