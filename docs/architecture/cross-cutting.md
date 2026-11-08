# Cross-cutting concerns

The concerns every feature shares, one picture each: settings, observability, security layers, privacy and environments. Use when you add a setting, a log line or metric, a check on a request, a table that holds personal data, or a deploy step, and want to see where it fits.

## Settings

```mermaid
flowchart LR
  accTitle: Settings, from definition to check
  accDescr: Settings are declared per environment in wrangler.jsonc vars, in .dev.vars locally, and as Worker secrets; setup scripts write some of them. The app parses them in apps/web/src/lib/config.ts, which has no defaults for required settings. buildPlatform builds the adapters once per isolate from the settings; a missing or invalid one fails every request with a 500 that names it, and is not cached, so the fix applies on the next request. The readiness endpoint reports it as the settings:configuration check, and bun run doctor checks the same settings locally and per environment before a deploy.
  Vars["wrangler.jsonc vars, per environment"]
  DevVars[".dev.vars, local"]
  Secrets["Worker secrets: setup:secrets"]
  Config["lib/config.ts: parse, no defaults"]
  Platform["buildPlatform: once per isolate"]
  Error["500 naming the setting"]
  Health["/health/ready: settings:configuration"]
  Doctor["bun run doctor"]
  Vars --> Config
  DevVars --> Config
  Secrets --> Config
  Config --> Platform
  Platform -->|invalid| Error
  Config --> Health
  Vars --> Doctor
  DevVars --> Doctor
```

A required setting (`LOG_SINK`, `METRICS`, `RATE_LIMITING`, `BILLING`, …) has no default: every environment states it, and the app refuses to guess. "Validated at startup" means at the first request of each isolate, since a Worker has no boot step of its own. Code: [lib/config.ts](../../apps/web/src/lib/config.ts), [server/platform.ts](../../apps/web/src/server/platform.ts), [scripts/doctor.ts](../../scripts/doctor.ts), [server/health.ts](../../apps/web/src/server/health.ts). The list of settings: [Environments and bindings](overview.md#environments-and-bindings).

## Observability

```mermaid
flowchart LR
  accTitle: Logs, traces, metrics and health
  accDescr: The edges of the Worker, which are the HTTP edge, the tRPC middleware, MCP tools, the queue consumer and the cron handler, open one span and record one duration metric per unit of work, and log and report errors under the request context's trace id. They write through four ports. The Logger, ErrorReporter and Tracer adapters write JSON records to Workers Logs, which also keeps Cloudflare's own invocation logs and traces. The Metrics adapter writes to the Analytics Engine dataset METRICS_DATASET, flushed once per unit of work. Uptime monitors call /health/live and /health/ready, which probe D1, R2 and the bindings.
  Edges["edges: HTTP, tRPC, MCP tools, queue, cron"]
  Logger["Logger port"]
  Errors["ErrorReporter port"]
  Tracer["Tracer port"]
  Metrics["Metrics port"]
  Logs["Workers Logs: logs, error reports, span records"]
  AE["Analytics Engine: METRICS_DATASET"]
  Monitor["Uptime monitor"]
  Health["/health/live, /health/ready"]
  Probes["D1, R2, queue, email, settings, bindings"]
  Edges --> Logger
  Edges --> Errors
  Edges --> Tracer
  Edges --> Metrics
  Logger -->|LOG_SINK| Logs
  Errors -->|ERROR_REPORTER| Logs
  Tracer -->|TRACING| Logs
  Metrics -->|METRICS| AE
  Monitor --> Health
  Health --> Probes
```

Use cases are never instrumented; they get a logger bound to the trace, and the edges measure them. The trace id is the `x-request-id` on every response and the `reference` in every 500, so one search in Workers Logs finds a request's logs, spans and error report. Guides: [how-to-setup-logging.md](../guides/how-to-setup-logging.md), [how-to-setup-error-reporting.md](../guides/how-to-setup-error-reporting.md), [how-to-setup-metrics-and-tracing.md](../guides/how-to-setup-metrics-and-tracing.md), [how-to-monitor-health.md](../guides/how-to-monitor-health.md).

## Security layers

```mermaid
flowchart TB
  accTitle: Security layers of a request
  accDescr: From the outside in. Every response carries the security headers and, for HTML, a Content-Security-Policy; static assets get the same from public/_headers. Edge rate limits refuse over-limit requests on auth, MCP, uploads, health, webhooks, token pages and every tRPC mutation. Turnstile checks sign-up, sign-in and password reset. Better Auth resolves the session or the MCP token, and the security state checks that session and its second factor. The workspace membership resolves the actor, the role's permission is checked with can, then the plan's entitlements. The use case changes data and records an audit event.
  Headers["security headers and CSP: every response"]
  Limits["edge rate limits: route policies, every mutation"]
  Human["Turnstile: sign-up, sign-in, password reset"]
  Auth["session or MCP token, security state, second factor"]
  Actor["workspace membership: resolveActor"]
  Permission["permission: requirePermission, can"]
  Entitlement["plan: requireFeature, requireLimit"]
  Audit["use case and audit event"]
  Headers --> Limits --> Human --> Auth --> Actor --> Permission --> Entitlement --> Audit
```

Not every request meets every layer: Turnstile guards only the account forms, and pages are not rate limited except the token pages. Each layer has a test that fails when something new skips it: `test/architecture/security-headers.test.ts`, `abuse.test.ts`, `workspace-scope.test.ts`, `entitlements.test.ts` and `audit-coverage.test.ts`. Code: [security-headers.ts](../../apps/web/src/server/security-headers.ts), [abuse/domain/policies.ts](../../packages/features/src/abuse/domain/policies.ts), [trpc/init.ts](../../apps/web/src/server/trpc/init.ts), [workspaces/domain/permissions.ts](../../packages/features/src/workspaces/domain/permissions.ts). Guides: [how-to-configure-security-headers.md](../guides/how-to-configure-security-headers.md), [how-to-configure-abuse-protection.md](../guides/how-to-configure-abuse-protection.md), [how-to-configure-account-security.md](../guides/how-to-configure-account-security.md).

## Privacy: export and erasure

```mermaid
flowchart LR
  accTitle: Data export and account erasure
  accDescr: Export. privacy.requestExport checks the limits and authorization, writes a data_requests row and enqueues privacy.build-export. The job reads D1 in pages and the user's R2 objects, streams them through the Zip port into a multipart upload in R2, checks authorization again, and notifies the user. The download route needs a signed, expiring link and the signed-in user. The hourly privacy.purge-exports removes expired archives. Erasure. Self-deletion through Better Auth and admin erasure share one pipeline: preflight refuses the last owner or last admin and takes the erasure lock, the owning features erase workspace and user artifacts in R2 and redact the audit subject, Better Auth deletes the user, whose rows cascade, and the after hook writes an erasure record, schedules delayed storage sweeps, records the audit event and sends a confirmation.
  subgraph Export["export"]
    Request["privacy.requestExport"]
    Build["job privacy.build-export: D1 pages, R2 objects, Zip"]
    Archive[("R2: export archive")]
    Download["/api/privacy/exports/id: signed link and session"]
    Purge["cron privacy.purge-exports"]
  end
  subgraph Erasure["erasure"]
    Delete["delete account or admin erasure"]
    Preflight["prepareUserErasure: last owner and admin, lock"]
    Artifacts["erasure-catalog: R2 objects, audit subject"]
    Cascade["Better Auth deletes the user, rows cascade"]
    Complete["completeUserErasure: erasure record, sweeps, mail"]
  end
  Request --> Build --> Archive --> Download
  Purge --> Archive
  Delete --> Preflight --> Artifacts --> Cascade --> Complete
```

`DATA_CATALOG` names, for every table, the columns an export contains and how erasure treats it, and `test/architecture/privacy.test.ts` fails for a table it misses. Code: [privacy/](../../packages/features/src/privacy/), [data-catalog.ts](../../packages/features/src/data-catalog.ts), [erasure-catalog.ts](../../packages/features/src/erasure-catalog.ts). Guide: [how-to-handle-data-privacy.md](../guides/how-to-handle-data-privacy.md).

## Environments

```mermaid
flowchart LR
  accTitle: Environments and deploys
  accDescr: Locally, bun run dev:web runs the Worker with simulated bindings and .dev.vars. A pull request runs CI. The Deploy workflow is started by hand for one environment, develop, staging or production. It runs verify, applies the D1 migrations, then deploys. Each environment is a section of wrangler.jsonc with its own D1 database, R2 bucket, queue and dead-letter queue, Analytics Engine datasets and rate-limit namespaces, and its secrets.
  Local["local: dev:web, .dev.vars, simulated bindings"]
  CI["ci.yml: lint, typecheck, tests, e2e, build"]
  Deploy["deploy.yml: manual, one environment"]
  Develop["develop: top level of wrangler.jsonc"]
  Staging["staging: env.staging"]
  Production["production: env.production"]
  Local --> CI --> Deploy
  Deploy -->|verify, migrations, deploy| Develop
  Deploy --> Staging
  Deploy --> Production
```

Bindings are not inherited between environments, so each section declares all of them; `test/architecture/wrangler.test.ts` checks that. Migrations go out before the code that needs them. Code: [apps/web/wrangler.jsonc](../../apps/web/wrangler.jsonc), [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml). Guides: [how-to-setup-web-app.md](../guides/how-to-setup-web-app.md), [how-to-setup-ci.md](../guides/how-to-setup-ci.md), [how-to-qa-a-deployment.md](../guides/how-to-qa-a-deployment.md).
