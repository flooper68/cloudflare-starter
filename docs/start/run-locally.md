# Run it locally

::reviewed{date="2026-11-09"}

Everything runs on your machine: the database, file storage, the job queue, schedules and email are simulated, and sign-in needs no outside service. You need Bun and nothing else; a Cloudflare account comes in when you [deploy](deploy.md).

::flow[Install -> Local settings -> Database -> Dev server -> Sign up]{title="Running locally: install, copy the local settings, migrate the database, start the dev server, sign up"}

:::prompt{title="Paste this into your coding agent"}
```text
Run this app locally: install, create apps/web/.dev.vars with setup:secrets, migrate the
local database, run doctor, start the dev server, and tell me the URL to open.
```
:::

:::byhand
```bash
bun install
cp apps/web/.dev.vars.example apps/web/.dev.vars   # or: bun run setup:secrets
bun run db:migrate:local
bun run doctor
bun run dev:web
```
:::

Open `http://localhost:4321` (the port of `APP_URL` in `.dev.vars`; `setup:secrets` proposes one per checkout so worktrees run side by side), create an account at `/sign-up`, and you land on the dashboard.

::shot{id="dashboard" alt="The dashboard of a freshly started app, with the getting-started checklist"}

## Try the parts

- **Jobs:** `/app/queue-demo` enqueues a job; the dev output shows it run, with the request's `trace_id`.
- **Schedules:** `curl "http://localhost:4321/cdn-cgi/local/scheduled?cron=17+3+*+*+*"` runs the daily ones.
- **Email:** every mail is logged and saved under `apps/web/.wrangler/tmp/email/`.
- **Agents:** the agent endpoint needs a deployed app; locally `bun run test` covers the tools.

:::gotcha{title="Signed in, then bounced back to /sign-in?"}
`APP_URL` must match the browser's origin exactly, port included.
:::

:::gotcha{title="Every page answers 500"}
A required setting is missing or blank; the error names it. A blank line in `.dev.vars` unsets a value. Common causes: [troubleshooting](../reference/deployment.md#common-problems).
:::

Next: [Deploy](deploy.md), and [What it costs](what-it-costs.md).
