# How To Monitor Health (Uptime Monitors And Status Pages)

The web Worker answers three public health endpoints for uptime monitors, load balancers and status pages: liveness, readiness, and `/health` as an alias of readiness. Readiness checks every dependency with a deadline and answers in the [IETF health check response format](https://datatracker.ietf.org/doc/draft-inadarei-api-health-check/) (`application/health+json`). This guide covers the endpoints, the body, what each check does and costs, what the public can see, how platform admins see more, and how to wire Cloudflare Health Checks, UptimeRobot or Better Stack and a status page. Use when you set up monitoring for an environment, add or change a check, or investigate a failing check.

## Endpoints

| Endpoint            | Methods   | Answers                                                                     | Use it for                                                                                     |
| ------------------- | --------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /health/live`  | GET, HEAD | always `200 {"status":"pass"}` while the Worker runs; touches no dependency | "is the Worker reachable": DNS, routing, deploys, a broken build                               |
| `GET /health/ready` | GET, HEAD | `200` for `pass` and `warn`, `503` for `fail`; the report below             | "can users use it": the monitor and status page signal                                         |
| `GET /health`       | GET, HEAD | the same as `/health/ready`                                                 | monitors and status pages that try `/health` first; prefer `/health/ready` when you set one up |

`/health` is an alias of readiness, not of liveness, on purpose: whoever points a monitor at `/health` wants to know whether the app works. Liveness matters to orchestrators that restart processes, which Workers do not need; here it only tells "the Worker answers" apart from "a dependency is down".

Every answer has `Cache-Control: no-store` (a cached "pass" hides an outage), `RateLimit-Policy: "health.ip";q=120;w=60`, and the request's `x-request-id` and `traceparent`. HEAD returns the same status and headers without a body. The endpoints are Astro routes (`apps/web/src/pages/health/`), not part of the SPA; the middleware gives them a request context but never looks up a session, so they never read the session tables. Nothing on them writes to D1.

Liveness keeps answering when a setting is missing or invalid (where every other route answers `500 Server Misconfigured`), and readiness then reports the `settings:configuration` check as failed (`onMisconfigured` in `apps/web/src/server/http.ts`).

## Response format

```bash
curl -s https://<your-app>/health/ready
```

```json
{
  "status": "pass",
  "version": "1",
  "releaseId": "3f2c1d7e-8a41-4b7e-9f3a-5d0c2e6b9a17",
  "serviceId": "cloudflare-starter-web",
  "description": "Readiness of cloudflare-starter-web",
  "checks": {
    "d1:responseTime": [
      {
        "componentType": "datastore",
        "status": "pass",
        "time": "2026-11-06T10:00:00.004Z",
        "observedValue": 4,
        "observedUnit": "ms"
      }
    ],
    "r2:responseTime": [
      {
        "componentType": "datastore",
        "status": "pass",
        "time": "…",
        "observedValue": 18,
        "observedUnit": "ms"
      }
    ],
    "queue:binding": [
      { "componentType": "component", "status": "pass", "time": "…" }
    ],
    "email:configuration": [
      { "componentType": "component", "status": "pass", "time": "…" }
    ],
    "settings:configuration": [
      { "componentType": "system", "status": "pass", "time": "…" }
    ],
    "rate-limits:bindings": [
      { "componentType": "component", "status": "pass", "time": "…" }
    ],
    "analytics-engine:bindings": [
      { "componentType": "component", "status": "pass", "time": "…" }
    ]
  },
  "reference": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

When a check fails, the overall `status` is `fail`, the answer is `503`, and the body says which check and why, in a fixed word:

```json
{
  "status": "fail",
  "output": "1 of 7 checks failed",
  "checks": {
    "d1:responseTime": [
      {
        "componentType": "datastore",
        "status": "fail",
        "time": "…",
        "observedValue": 2000,
        "observedUnit": "ms",
        "output": "timeout"
      }
    ]
  },
  "reference": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

| Field       | Meaning                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `status`    | `pass`, `warn` (up, with a concern) or `fail`: `fail` if any check failed, else `warn` if any warned                                                                           |
| `version`   | the health API's own version (`HEALTH_API_VERSION` in `apps/web/src/server/health.ts`); changes only when the body changes incompatibly                                        |
| `releaseId` | the deployed Worker version (`CF_VERSION_METADATA`, `local` without it): the `service.version` of every log record, so a status change lines up with a deploy                  |
| `serviceId` | `SERVICE_NAME` (`apps/web/src/server/platform.ts`), the OpenTelemetry `service.name`                                                                                           |
| `output`    | summary when not `pass`                                                                                                                                                        |
| `checks`    | `<component>:<measurement>` → entries with `componentType`, `status`, `time`, and for service calls `observedValue` / `observedUnit` (latency in ms); `output` when not `pass` |
| `reference` | extension member: the trace id of this request (also `x-request-id`). Search the logs for it to see what went wrong                                                            |

Check outputs are fixed words: `timeout`, `error`, `slow`, `missing binding`, `not configured`.

## What each check does

Checks run in parallel; each has a deadline of 2 s (`HEALTH_CHECK_TIMEOUT_MS`), so readiness answers within about 2 s even when a dependency hangs. A service check slower than 1 s (`HEALTH_WARN_ABOVE_MS`) is `warn` (`slow`).

| Check                       | What it does                                                                                            | `fail` when                                                                   | `warn` when                                    | Cost per call             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------- |
| `d1:responseTime`           | `SELECT 1` on `DB` (`probeDatabase`): no table, no rows, no write                                       | it throws or takes over 2 s                                                   | over 1 s                                       | one D1 query, 0 rows read |
| `r2:responseTime`           | `head` of the key `health/probe` on `FILES` (`probeBucket`): nothing is ever stored there               | it throws or takes over 2 s                                                   | over 1 s                                       | one R2 Class B operation  |
| `queue:binding`             | the `APP_QUEUE` producer is bound; nothing is sent                                                      | it is missing                                                                 |                                                | none                      |
| `email:configuration`       | the `EMAIL` binding and `EMAIL_FROM` are set (as `buildPlatform` decides); nothing is sent              | missing while `AUTH_REQUIRE_EMAIL_VERIFICATION` is on (sign-up cannot finish) | missing otherwise (the app serves, minus mail) | none                      |
| `settings:configuration`    | the settings parse as every request parses them (`buildPlatform`, `buildRequiredConfig`)                | a setting is missing or invalid (every other route answers 500)               |                                                | none                      |
| `rate-limits:bindings`      | with `RATE_LIMITING=cloudflare`, every binding of the rate-limit catalog is bound                       | one is missing                                                                |                                                | none                      |
| `analytics-engine:bindings` | `METRICS_DATASET` with `METRICS=analytics-engine`, `ANALYTICS_EVENTS` with `ANALYTICS=analytics-engine` | one is missing                                                                |                                                | none                      |

At one probe every 30 s from three regions that is about 260,000 readiness calls a month: well inside D1's and R2's free tiers, plus the Worker invocations themselves.

## What the public sees, and what it does not

The endpoints are public and unauthenticated by design: monitors cannot sign in. So they show as little as a monitor needs:

- Shown: overall and per-check status, latency in ms, the fixed output words, the Worker version id, the service name, the dependency names (`d1`, `r2`, …; the starter is open source, so this reveals nothing new) and the trace id.
- Never shown: error messages, stack traces, hostnames, binding or setting names, values, secrets, user data. A test asserts that a D1 error message does not reach the body.
- Liveness shows only `{"status":"pass"}`.

What went wrong goes to the logs: each check that did not pass is one record (`health.check_failed` at ERROR, `health.check_degraded` at WARN) with `app.health.check`, `app.health.status`, `app.health.output`, `app.health.detail` (the error message, the missing binding or setting) and `app.health.observed_ms`, on the request's `trace_id` ([how-to-setup-logging.md](how-to-setup-logging.md)). Filter Workers Logs on `trace_id = <reference>`.

## Rate limit

`health.ip` (120 requests a minute per IP, binding `RL_HEALTH`) counts all three endpoints together, before any check runs: monitors probe every 30 to 60 s per region, so it never bites them, while a flood cannot turn into D1 and R2 calls. Past it, the answer is the usual 429 Problem Details with `Retry-After` and `RateLimit` ([how-to-configure-abuse-protection.md](how-to-configure-abuse-protection.md)), also `no-store`. When the settings are invalid there is no rate limiter to ask, and the endpoints answer unlimited.

## Tracing and metrics

Each check is a span `health.check <check>` (internal, a child of the request's server span) with `app.health.check`, `app.health.component_type`, `app.health.status` and `app.health.observed_ms`, and error status when it failed ([how-to-setup-metrics-and-tracing.md](how-to-setup-metrics-and-tracing.md)). There is no metric of its own: the HTTP edge already records `http.server.request.duration` by `http.route` (`/health/ready`) and status code, which gives probe count, latency and 503 rate. A metric per check and probe call would multiply Analytics Engine writes by seven for every probe and repeat what the monitor already records.

## Platform admins

The admin portal's Overview runs the same checks live when it opens (and on **Check again**) and shows each failure's detail next to its output (`missing binding: not bound: APP_QUEUE`). Over tRPC it is `admin.health.get`, over MCP `admin_get_health` (an `adminProcedure`: `NOT_FOUND` for everyone else). It is a live check, not stored data, so it is the same answer the monitor would get at that moment, with the detail the public body leaves out.

## Wiring an uptime monitor

Point the monitor at `https://<your-app>/health/ready`, alert on any status other than 200 (or on the body's `"status":"fail"`), and keep its timeout above 2 s (5 s is safe). A separate monitor on `/health/live` tells "the Worker is unreachable" apart from "a dependency is down".

- **Cloudflare Health Checks** (on paid zone plans; Traffic → Health Checks in the dashboard): type HTTPS, path `/health/ready`, method GET, expected codes `200`, timeout 5 s, interval 60 s, several check regions; add a notification for health check status changes. Cloudflare probes from its own IPs, each counted on its own by `health.ip`.
- **UptimeRobot**: monitor type HTTP(s), URL `https://<your-app>/health/ready`, interval 1 to 5 minutes. Optionally a keyword monitor on `"status":"fail"` set to alert when the keyword exists; status codes alone are enough, since `fail` is 503.
- **Better Stack (Uptime)**: monitor type "URL becomes unavailable" on `/health/ready`, or "URL doesn't contain keyword" with `"status":"pass"` if you want a `warn` to page too; request timeout 5 s; regions of your choice.
- **Cloudflare Load Balancing monitors**: path `/health/ready`, expected codes `200`.

A `warn` answers 200 on purpose: the app works (mail is off, or a dependency is slow). Alert on `warn` only through a keyword check, if at all.

## Status pages

Status pages (Better Stack, UptimeRobot, Atlassian Statuspage via a monitor integration) publish the monitor's result; map `/health/ready` to the "App" component. The per-check entries let you split components (`d1:responseTime` as "Database", `r2:responseTime` as "File storage") with a keyword or JSON check where the tool supports it. Status pages show the result, not the body, so nothing more than the status leaves the app.

## Adding a check

1. A probe that calls a service is a use case in `packages/features/src/health/` (`probe-<thing>.ts`, one function, an integration test against the real binding). A configuration check returns a `ProbeOutcome` from a pure rule in `health/domain/probe-outcome.ts` (with a domain test).
2. Add it to `readinessProbes` in `apps/web/src/server/health.ts`: a name `<component>:<measurement>`, a `componentType` (`datastore`, `component` or `system`), `measured: true` and `warnAboveMs` for service calls.
3. Keep it cheap and read-only: no writes, no mail, no enqueued jobs, nothing per user. Monitors call it every few seconds across regions.
4. Update the check list in `apps/web/test/api/health.test.ts` (`CHECKS`), this guide's table and the `admin_get_health` description.

## Troubleshooting

| Symptom                                          | Look at                                                                                                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `503` with `settings:configuration` failed       | the logs under the `reference` (`app.health.detail` names the setting), or `bun run doctor`; every other route answers `500 Server Misconfigured` meanwhile |
| `d1:responseTime` or `r2:responseTime` `timeout` | the Cloudflare status page for D1 or R2 and the Worker's Observability → Traces (time per binding call)                                                     |
| `email:configuration` `warn`                     | `EMAIL_FROM` and the `EMAIL` binding ([how-to-setup-email.md](how-to-setup-email.md)); a `fail` means verification is required but mail is off              |
| `429` on the health endpoints                    | many monitors behind one IP: raise `health.ip` in `packages/features/src/abuse/domain/policies.ts` and `RL_HEALTH` in every environment of `wrangler.jsonc` |
| The monitor sees a stale `pass`                  | a cache in front of the Worker ignoring `no-store`: exempt `/health*` from caching rules                                                                    |
