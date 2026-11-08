# How to run container workflows

> **Starter-only, removed by `starter:strip`** (`container-workflow-demo`): the strip deletes the demo and this guide: the container-runs feature and its three tables (it regenerates `0000_init`), the Workflow, the page, the tRPC procedures and MCP tools, the settings and the `container.run` rate limit; keep them with `--keep container-workflow-demo` ([how-to-start-a-project.md](how-to-start-a-project.md)). Without `containers` too, keep the demo on the fake runner.

The worked example for long-running work: the container workflow demo at `/app/container-demo`, where a Cloudflare Workflow runs a real task in a Cloudflare Container (digits of pi), stores the result in R2, notifies the person who started it and marks the run done, with every step's state visible. It covers when to use a container instead of a Worker, when to use Workflows instead of the queue, the settings, limits and cost controls of a public demo, what it costs, local development with a fake container, deploying, and removing it. Use when you add work that runs longer than a request, needs a binary or a language the Workers runtime lacks, or needs several durable steps; or when you run, tune, deploy or remove the container demo.

## What the demo does

```mermaid
flowchart LR
  UI["/app/container-demo<br/>or MCP start_container_run"] -->|containerRuns.start| UC[startContainerRun<br/>limits, D1 row, audit]
  UC -->|CONTAINER_RUN_WORKFLOW.create| WF[ContainerRunWorkflow]
  WF -->|1 start container| C[(pi container<br/>apps/container)]
  WF -->|2 compute| C
  WF -->|3 store| R2[(FILES bucket)]
  WF -->|4 notify| Q[notifications<br/>in-app, email per preferences]
  WF -->|5 done| D1[(container_runs)]
  UI -. polls containerRuns.get every second .-> D1
```

1. **Accept.** `containerRuns.start` (tRPC, or the `start_container_run` MCP tool) checks the permission, `CONTAINER_DEMO`, the person's hourly limit and the deployment's daily cap, writes a `container_runs` row (`queued`) and starts a Workflow instance whose id is the run's id.
2. **Run the container task.** Step "start container" wakes one of the two container instances (retried up to 3 times: a container can take a moment to provision). Step "compute" asks it for N digits of pi (1,000, 10,000 or 50,000).
3. **Store.** The digits go to R2, `workspaces/<workspaceId>/container-runs/<runId>.txt` in the `FILES` bucket; the row keeps the first 100 digits, the size and the container's compute time.
4. **Notify.** `container-runs.finished` to the person who started it: in the app by default, by email when they turn it on in their notification preferences.
5. **Done.** The run is `succeeded`, `container_run.finished` is audited.

Each step records its start in the row's `steps` timeline inside the step itself, so a retried step records nothing twice, and Workflows keeps each finished step's result, so a replay never repeats one. A step that runs out of retries fails the run with a stable code (`container_unavailable`, `compute_failed`, `storage_failed`, `internal`), skips the remaining steps, notifies the person, and fails the instance (visible in the dashboard under Workflows). Retry on the page (or `start_container_run` with `retryOf`) starts a new run with the same digits; it counts against the limits like any run.

The page polls the run every second while it is queued or running (plain `fetch` through the tRPC client, nothing inline, so the strict CSP holds) and shows each step's state and time, then the preview, the download (`GET /api/container-runs/<id>/result`, members of the workspace only), the run's duration, and the workspace's past runs.

## Container or Worker

| Use a Worker (or a job) when …                                                         | Use a container when …                                                                                                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| the work is JavaScript, TypeScript or WebAssembly that fits the Workers runtime        | it needs a binary, a language runtime or a library the Workers runtime does not have (Python here, ffmpeg, a headless browser, a CLI) |
| it fits a request's limits: 30 s of CPU by default (up to 5 minutes), 128 MB of memory | it needs more memory or disk, a filesystem, or long CPU-bound work in one process                                                     |
| it should start in milliseconds and cost nothing while idle                            | a few seconds of cold start are fine (the container starts on the first request and sleeps after 30 s idle)                           |

Pi itself would fit a Worker: the fake runner computes 50,000 digits in about 50 ms of Worker CPU. The demo uses a container to show the pattern for work that does not fit, with a task that finishes in seconds.

## Workflows or Queues

The demo uses **Cloudflare Workflows**. The queue ([how-to-add-background-jobs.md](how-to-add-background-jobs.md)) stays the tool for one retryable step.

| Workflows when …                                                                                                                            | A queue job when …                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| there are several steps and a finished one must not run again after a later one fails (each `step.do` is retried and remembered on its own) | it is one step; running it again is safe (or guarded by an idempotency key) |
| the steps have their own retry and timeout policies (here: 3 retries to wake the container, 1 to compute)                                   | one backoff for the whole job is enough                                     |
| it waits: `step.sleep` up to a year, `step.waitForEvent` for a person or a webhook                                                          | it finishes within one consumer invocation (15 minutes)                     |
| you want each instance's status and step history in the dashboard                                                                           | logs and the dead-letter queue are enough                                   |

Why not the queue here: the steps are long (a container start can take seconds and may need retries), their results must survive a failure in a later step (the computed digits must not be recomputed because R2 failed), and the per-step state is what the page shows. With a queue that would be a chain of jobs plus our own state machine for retries; Workflows gives it per step. Limits that matter, from [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/): a step's result is at most 1 MiB (50,000 digits are about 50 KB), 30 s of CPU per step by default (waiting on the container is not CPU), instances are kept 7 days by default (the run sets 7 days explicitly).

## How it is built

| Part                               | Where                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature (use cases, rules, tables) | `packages/features/src/container-runs/`: `start-container-run.ts`, `get-container-run.ts`, `list-container-runs.ts`, `read-container-run-result.ts`; the workflow's steps `begin-container-run-step.ts`, `store-container-run-result.ts`, `notify-container-run-finished.ts`, `finish-container-run.ts`; retention `purge-container-runs.ts`; erasure `delete-workspace-container-runs.ts`; reconciliation `find-referenced-container-run-keys.ts` |
| Step state machine                 | `container-runs/domain/run-steps.ts` (pure; `run-steps.test.ts`)                                                                                                                                                                                                                                                                                                                                                                                   |
| Tables                             | `container_runs` (workspace-scoped, cascades with the workspace), `container_run_quota` (the daily cap, one counter per UTC day) and `container_run_user_quota` (the hourly limit, one counter per person and UTC hour, cascades with the user); in the regenerated `packages/features/migrations/0000_init.sql`                                                                                                                                   |
| Workflow                           | `apps/web/src/server/container-run-workflow.ts` (`ContainerRunWorkflow`, exported from `src/worker.ts`)                                                                                                                                                                                                                                                                                                                                            |
| Ports and adapters                 | `PiComputer` (`platform/ports/pi-computer.ts`): `createContainerPiComputer` (the `PI_CONTAINER_SERVICE` service binding) and `createFakePiComputer` (in the Worker); `ContainerRunWorkflows` (`container-runs/domain/ports.ts`), implemented in `apps/web/src/server/container-runs.ts`                                                                                                                                                            |
| tRPC and MCP                       | `containerRuns.start`, `containerRuns.get`, `containerRuns.list` (`server/trpc/container-runs-router.ts`); tools `start_container_run`, `get_container_run`, `list_container_runs`                                                                                                                                                                                                                                                                 |
| Download                           | `apps/web/src/pages/api/container-runs/[id]/result.ts`                                                                                                                                                                                                                                                                                                                                                                                             |
| Page and components                | `apps/web/src/components/app/pages/ContainerDemoPage.tsx`; `ContainerRunTimeline`, `ContainerRunList`, `ContainerRunStatusBadge` in `packages/ui/src/components/patterns/container-run.tsx` (Storybook: Patterns/Containers)                                                                                                                                                                                                                       |
| The container                      | `apps/container`: a Worker (`src/index.ts`, `PiContainer`) in front of a Python image (`server.py`, `pi_task.py`: the Chudnovsky series by binary splitting, up to 100,000 digits) ([how-to-setup-container.md](how-to-setup-container.md))                                                                                                                                                                                                        |

Platform pieces it uses: audit events `container_run.started` (the member) and `container_run.finished` (the system, with the outcome and the error code as `failure`); product event `container_runs.started` (`digits`, `kind`: new or retry); notification `container-runs.finished`; permissions `containers.read` and `containers.run` (every member); rate-limit policy `container.run`; cron entry `container-runs.purge`; the privacy catalog; the storage reconciliation.

## Settings

All three are required vars in every environment of `apps/web/wrangler.jsonc`, with no defaults: the Worker refuses to start with one missing or invalid.

| Setting                    | Values                                                               | develop (and local) | staging     | production  |
| -------------------------- | -------------------------------------------------------------------- | ------------------- | ----------- | ----------- |
| `CONTAINER_DEMO`           | `on` or `off`                                                        | `on`                | `off`       | `on`        |
| `CONTAINER_DEMO_DAILY_CAP` | runs per UTC day for the whole deployment, 1 to 10,000               | `50`                | `20`        | `100`       |
| `CONTAINER_DEMO_RUNNER`    | `container` (the pi container) or `fake` (pi computed in the Worker) | `fake`              | `container` | `container` |
- **develop** runs the whole workflow (Workflows, D1, R2, notifications) with the fake runner, so the develop deploy and local dev start no container. Set `container` there to try the real one.
- **staging** is off; turn it on to rehearse the real container before a production change. Its container Worker is deployed either way and costs nothing while idle.
- **production** is on (owner decision), with the real container and a cap of 100 runs a day.

With `off`, or once the day's cap is used, the page says why instead of offering a run; past runs stay readable until they expire.

## Limits and cost controls

A public production demo must not let anyone run containers without bound. Five layers, outermost first:

| Layer                   | What                                                                                                                                                                                                                                                                                                                     | Where                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| No public container URL | The container Worker has `workers_dev: false` and `preview_urls: false`; only the web Worker's service binding reaches it                                                                                                                                                                                                | `apps/container/wrangler.jsonc`                                                                             |
| Burst limit at the edge | `container.run`: 3 starts a minute per user (`RL_CONTAINER_RUN`, namespace ids 7014, 8014, 9014)                                                                                                                                                                                                                         | `packages/features/src/abuse/domain/policies.ts` ([abuse protection](how-to-configure-abuse-protection.md)) |
| Per-user hourly limit   | 5 runs per UTC hour per person, across workspaces (`CONTAINER_RUN_USER_HOURLY_LIMIT`), one atomic upsert of `container_run_user_quota` per start                                                                                                                                                                         | `startContainerRun`                                                                                         |
| Global daily cap        | `CONTAINER_DEMO_DAILY_CAP` runs per UTC day, one atomic upsert of `container_run_quota` per start; deleting a workspace does not give runs back                                                                                                                                                                          | `startContainerRun`                                                                                         |
| Container limits        | the smallest instance type (`lite`: 1/16 vCPU, 256 MiB, 2 GB disk), `max_instances: 2`, `sleepAfter: "30s"`, no internet; the presets top out at 50,000 digits (about 5 s on `lite`); the container steps time out after 1 minute (start: 3 retries, compute: 1), so a run holds an instance for at most about 7 minutes | `apps/container/wrangler.jsonc`, `apps/container/src/index.ts`, `container-run-workflow.ts`                 |

Both counters are atomic upserts that only grow while under their limit, and both are kept apart from the runs: deleting a workspace (and its runs) gives back neither the hour's nor the day's runs. The hourly window is the UTC clock hour. When the day is full, the hour's slot is given back.

## What it costs

Prices from Cloudflare's docs, checked 8 November 2026: [Containers pricing](https://developers.cloudflare.com/containers/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (Workflows, Durable Objects, D1), [Workflows pricing](https://developers.cloudflare.com/workflows/reference/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/). Containers bill each 10 ms an instance is running, from the first request until it sleeps; memory and disk on the instance type's size, CPU on use.

**One run**, with a cold start (the costly case): about 5 s to start, up to 5 s to compute 50,000 digits on `lite`, then 30 s idle before it sleeps: about 40 s of a `lite` instance.

| Item                                                         | Usage per run                         | Price above the plan's allowance     | Cost per run       |
| ------------------------------------------------------------ | ------------------------------------- | ------------------------------------ | ------------------ |
| Container memory                                             | 0.25 GiB × 40 s = 10 GiB-s            | $0.0000025 / GiB-s                   | $0.000025          |
| Container CPU                                                | at most 1/16 vCPU × 40 s = 2.5 vCPU-s | $0.000020 / vCPU-s                   | $0.00005           |
| Container disk                                               | 2 GB × 40 s = 80 GB-s                 | $0.00000007 / GB-s                   | $0.0000056         |
| Workflow steps                                               | 5 to 6                                | $0.80 / 100,000                      | $0.000048          |
| Workers requests (start, ~30 polls, download, service calls) | about 40                              | $0.30 / million                      | $0.000012          |
| D1 rows written, R2 write, Durable Object requests           | about 15 rows, 1 Class A, 2 requests  | $1.00 / M rows, $4.50 / M, $0.15 / M | $0.00002           |
| **Total**                                                    |                                       |                                      | **about $0.00016** |

A warm instance (another run within 30 s) costs less: no start, and the idle time is shared.

**A month at the cap** (production: 100 a day, 3,000 runs): 30,000 GiB-s of memory (8.3 of the 25 GiB-hours included), at most 7,500 vCPU-s (125 of the 375 vCPU-minutes included), 240,000 GB-s of disk (67 of the 200 GB-hours included), about 18,000 Workflow steps (of 500,000 included). **It fits in the $5 Workers Paid plan's included usage: $0 extra**, unless other work in the account already uses those allowances; then about **$0.50 a month** at the cap. A pathological month, where every run hits every step timeout and retry (4 × 1 minute to start, 2 × 1 minute to compute, the backoffs and 30 s idle: about 450 s of instance time each, with the CPU busy throughout), would use 93.75 GiB-hours of memory, 1,406 vCPU-minutes and 750 GB-hours of disk: about **$2.00 beyond the included usage** ($0.62 memory, $1.24 CPU, $0.14 disk), $2.72 without it. A hung container uses little CPU, so a real month is far below that. Without the cap the only bound would be the per-user limits times the number of accounts, which is why the cap is required.

## Run it locally

`bun run dev:web` is enough: local dev starts from the develop vars, so the demo is on with the fake runner. The Workflow runs in Miniflare, the result goes to the local R2, the notification to the local inbox. Open **Developer demos › Containers**.

To run the real container: Docker running, both apps with `bun run dev` (the web app and `apps/container` on port 8790; Wrangler's dev registry connects the `PI_CONTAINER_SERVICE` service binding between them), and `CONTAINER_DEMO_RUNNER=container` in `apps/web/.dev.vars`. The first run builds the image and takes longer.

## Deploy

Nothing to create by hand: the Workflow is created by `wrangler deploy` of the web Worker, the container image is built and pushed by `wrangler deploy` of the container Worker. The deploy scripts deploy the container Worker first, so the service binding has a target:

```bash
# Both Workers for one environment (what the Deploy workflow runs). Needs Docker.
cd apps/web
bun run deploy:production   # also deploy (develop) and deploy:staging

# Or one at a time
cd apps/container && bun run deploy:production   # builds and pushes the image
cd apps/web && CLOUDFLARE_ENV=production SITE_URL=https://starter.flooper.me bun run build && bunx wrangler deploy

# The tables: an environment that already applied an older 0000_init gets the three tables'
# CREATE statements from packages/features/migrations/0000_init.sql applied by hand first
# (docs/guides/how-to-setup-d1.md#changing-the-schema), e.g.
cd apps/web && bunx wrangler d1 execute DB --remote --env production --file <the container tables' statements>.sql

# Check
bunx wrangler workflows list
bunx wrangler containers list
bunx wrangler workflows instances list cloudflare-starter-container-run-production
```

The first container deploy can take a few minutes to provision; runs started meanwhile fail `container_unavailable` and can be retried. Dry runs: `CLOUDFLARE_ENV=production bun run deploy:dry-run` in `apps/web` and `bunx wrangler deploy --dry-run --env production` in `apps/container`.

Names are per environment because Workflow and Worker names are account-wide: the Workflows `cloudflare-starter-container-run`, `-staging`, `-production`; the container Workers `cloudflare-starter-container`, `-staging`, `-production`. A project built from the starter renames them with its Worker.

## Data, retention and privacy

- A run and its result expire 7 days after they start (`expires_at`); the daily cron entry `container-runs.purge` deletes the R2 objects, then the rows. Workflows keeps the instance for 7 days too.
- Runs belong to their workspace: deleting the workspace (in its settings, or with the account) deletes the R2 results (`deleteWorkspaceContainerRuns`, called by `workspace.delete` and `erasure-catalog.ts`) and the rows (cascade); the storage reconciliation recognises `workspaces/<id>/container-runs/` keys, so a result whose run is gone is an orphan it can report and delete.
- `container_runs` is in the privacy export catalog (`DATA_CATALOG`): the runs a person started and every run of their personal workspace. It holds digits of pi and timings, no personal content beyond who started it; erasure keeps shared runs with `created_by` nulled. `container_run_quota` holds counters only; `container_run_user_quota` (the person's runs per hour) is exported with the person's data and goes with the account.
- Audit events name the run, never the digits.

## Agents

An agent runs the demo the way a person does, through the MCP tools: `start_container_run` (`digits`, or `retryOf` a failed run) returns the run id at once; `get_container_run` returns the status and timeline, so the agent polls it until `succeeded` or `failed`; `list_container_runs` lists the workspace's runs and whether a new one can start (`on`, `off`, `daily_cap_reached`, `hourly_limit_reached`). The same limits apply; the tool calls also count against `mcp.user`.

## Tests

| Layer                     | Where                                                                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit                      | `container-runs/domain/run-steps.test.ts` (the state machine: order, retries, failures, durations), `run-summary.test.ts` (keys, cap day, expiry, input), `notification.test.ts`; `apps/web/src/lib/config.test.ts` (the settings)                                 |
| Contract                  | `platform/ports/pi-computer.contract.ts`, run by the fake (`fake-pi-computer.contract.test.ts`) and the container adapter against a stand-in of the container's HTTP API (`container-pi-computer.contract.test.ts`)                                                |
| Integration (real D1, R2) | one `*.integration.test.ts` per use case in `container-runs/`: the limits, the cap's atomic counter, retry rules, idempotent steps, purge, erasure, reconciliation                                                                                                 |
| API (workerd)             | `apps/web/test/api/container-runs.test.ts`: the real Workflow in Miniflare with the Workflows test utilities (`introspectWorkflow`: a full run, a failing step with `mockStepError`), the download, limits, off, auth, `expectCrossWorkspaceDenied`, the MCP tools |
| E2E                       | `apps/web/test/e2e/container-demo.spec.ts`: start a run on the page, watch every step finish, preview, download, past runs (fake runner)                                                                                                                           |

Containers have no local test runtime in workerd, so the real container is covered by its adapter's contract and checked by hand after a deploy (the QA checklist).

## Remove the demo, or keep containers without it

A project that does not want the demo deletes: `packages/features/src/container-runs/` and its lines in `database.ts`, `index.ts`, `analytics-events.ts`, `notification-catalog.ts`, `job-catalog.ts`, `cron-catalog.ts`, `data-catalog.ts`, `erasure-catalog.ts`, `storage-reference-catalog.ts`; the `containers.*` permissions, the `container_run.*` audit actions and the `container_run` target; the `container.run` policy and `PROCEDURE_POLICIES` entry; `platform/ports/pi-computer*.ts` and both adapters; `apps/web/src/server/container-runs.ts`, `container-run-workflow.ts`, `trpc/container-runs-router.ts`, the three tools, `pages/api/container-runs/`, `ContainerDemoPage.tsx`, its route, navigation entry and demo card; `packages/ui/src/components/patterns/container-run*.tsx`; the `CONTAINER_DEMO*` vars, the `workflows`, `services` and `RL_CONTAINER_RUN` entries of every environment of `apps/web/wrangler.jsonc` (and the test bindings); the tests above; this guide. It regenerates `0000_init` without `container_runs`, `container_run_quota` and `container_run_user_quota` ([how-to-setup-d1.md](how-to-setup-d1.md#changing-the-schema)); a project with real data drops them with a numbered migration. Without `apps/container` too, the deploy scripts drop the container deploy step.

A project that keeps containers but not the demo keeps `apps/container` (replacing the image), the `PiComputer`-style port with its service-binding adapter and contract test, the `services` binding, the Workflow pattern of `container-run-workflow.ts` (begin each step inside the step, a stable error code per step, a failure step) and the cost controls: `workers_dev: false`, the smallest instance type, `max_instances`, `sleepAfter`, a required on/off setting and a daily cap.

## Common problems

### Runs fail with "The container did not start"

Right after the first deploy the container is still provisioning: retry in a few minutes. Otherwise check that the container Worker of that environment is deployed (`bunx wrangler deployments list --name cloudflare-starter-container-production`) and that its image pushed (`bunx wrangler containers images list`). Locally with `CONTAINER_DEMO_RUNNER=container`: is `bun run dev:container` running, with Docker?

### The page says today's runs are used up

The cap counts runs started since 00:00 UTC across the deployment. Raise `CONTAINER_DEMO_DAILY_CAP` and deploy, or wait for the next UTC day.

### The Worker refuses to start: CONTAINER_DEMO is not set

The three settings are required in every environment's vars (`apps/web/wrangler.jsonc`); a value left blank in `.dev.vars` unsets the wrangler.jsonc one.

### A run stays at "Queued"

The Workflow instance did not start: look for `CONTAINER_RUN_WORKFLOW` errors in the logs, and `bunx wrangler workflows instances describe cloudflare-starter-container-run-<env> <runId>`.
