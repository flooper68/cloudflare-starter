# How to start a project from the starter

From this template to your own app, deployed. Use when you create a new product from the template, or when you want to know what `bun run starter:strip` removes.

## Start with one prompt

Open a coding agent (Claude Code or similar) in an empty folder, paste this, and replace `<name>` with the app's name:

```text
Create a new agent-native app called <name> from the template https://github.com/flooper68/cloudflare-starter. Read its AGENTS.md first, then follow its start-project skill (.claude/skills/start-project/SKILL.md). Ask me for each decision it needs, and before every change to my GitHub or Cloudflare account.
```

The agent follows the `start-project` skill ([.claude/skills/start-project/SKILL.md](../../.claude/skills/start-project/SKILL.md)): it checks the prerequisites (Bun, the GitHub CLI signed in, Wrangler logged in), creates your repository from the template with `gh`, strips the starter-only parts (`bun run starter:strip`), brands the app, runs the setup scripts (Cloudflare resources, auth and product settings, email, D1, secrets) and makes the first deploy. It asks you only for the decisions it needs (the name, what to keep, the product settings) and, before each one, for every change to your GitHub or Cloudflare account, listing what it will create or change. You type secrets yourself; the agent never sees them.

## What the strip removes

The template carries parts that exist only for the starter's public instance at `starter.flooper.me` and its repository. They are listed, with why each exists, in [starter-only.json](../../starter-only.json):

| Component                                                           | Default | What goes                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qa-automation`                                                     | strip   | The automated QA suite (`apps/web/test/qa/`, `playwright.qa.config.ts`, `scripts/qa*.ts`), the QA inbox Worker (`apps/qa-inbox`), the QA workflow and the deploy workflow's `qa` job, and the Turnstile bypass: `QA_BYPASS`, `QA_EMAIL_DOMAIN`, the `QA_TOKEN` secret, `RL_QA_BYPASS` and its code |
| `qa-journeys`                                                       | strip   | The QA suite's journeys (`apps/web/test/qa/*.qa.ts`, #54) and their section in testing.md                                                                                                                                                                                                          |
| `production-instance`                                               | strip   | The starter's production values in `wrangler.jsonc`: route, D1 id, Turnstile site key, sender, bootstrap admin and its product settings; `SITE_URL` of `deploy:production`. Reset to placeholders the setup scripts replace                                                                        |
| `marketing`                                                         | strip   | The starter's changelog history (reset to an empty Unreleased), the README's title, highlights and template steps, the docs site's repository links                                                                                                                                                |
| `brand-name`                                                        | strip   | "Cloudflare Starter" as the app's name (page titles, mail sender, authenticator issuer, passkeys, MCP server, docs title), replaced by `--name`                                                                                                                                                    |
| `developer-demos`                                                   | strip   | The Developer demos page and the queue and email demos; the upload demo stays as the file storage UI                                                                                                                                                                                               |
| `containers`                                                        | strip   | `apps/container`, its guide and its scripts                                                                                                                                                                                                                                                        |
| `starter-repo`                                                      | strip   | The CI job that tests the strip; prints the repository conventions to adopt or drop (the `pr-evidence` branch, the runner label, the authorship rule)                                                                                                                                              |
| `tasks`                                                             | keep    | The Tasks sample board (`/app/tasks`)                                                                                                                                                                                                                                                              |
| `notes`                                                             | keep    | Nothing: Notes is the worked example ([step 7](#7-keep-or-replace-the-placeholders))                                                                                                                                                                                                               |
| `qa-outbox`, `home-page-v2`, `demo-mode`, `container-workflow-demo` | strip   | Pending: their PRs have not landed on the starter yet; the strip skips them until they are marked active                                                                                                                                                                                           |

Things the strip does not touch: Storybook, background jobs, scheduled work, file storage, email, notifications, Google sign-in, billing and the other features. They are patterns a product may keep; removing one is in the README's strip table of the starter ([README](https://github.com/flooper68/cloudflare-starter#starting-a-new-project-from-this-starter)).

## Doing it by hand

The steps the agent runs, in order, for when you want to do them yourself or see what it does.

<details>
<summary>The steps, by hand</summary>

### 1. Create the repository from the template

On GitHub, **Use this template** → **Create a new repository** (or `gh repo create <owner>/<name> --template flooper68/cloudflare-starter --private --clone`). A template copy has none of the starter's history, so its first commit is yours. Then:

```bash
cd <name>
bun install
```

Update and pin the dependencies before you build on them: the pins are only as fresh as the starter's last change.

```bash
bun update --latest              # root
for d in apps/* packages/*; do (cd "$d" && bun update --latest); done
bun run verify && bun run build
```

`bunfig.toml` sets `exact = true`, so updates are written without `^`/`~`. Read the changelogs of any major bump. Two known holds: `astro check` needs TypeScript 6 until Astro supports TypeScript 7.1+, so keep `typescript` on the latest 6.x; and any peer ranges in `packages/ui` need bumping by hand ([dependencies.md](../processes/dependencies.md)).

### 2. Strip the starter-only parts

The template carries parts that exist only for the starter's public instance at `starter.flooper.me` and its repository. They are listed, with why each exists, in [starter-only.json](../../starter-only.json). `starter:strip` removes them:

```bash
bun run starter:strip --list                                   # the components, their status and default
bun run starter:strip --name "Acme" --repo-url https://github.com/acme/acme   # dry run: what it would change
bun run starter:strip --name "Acme" --repo-url https://github.com/acme/acme --apply
```

Without flags it asks about each component (Enter keeps the default). For an agent or a script: `--yes` takes the defaults, `--only <ids>` strips exactly those, `--keep <ids>` keeps some of the defaults. It is a dry run until `--apply`, and it is idempotent: run it again and it finds nothing to do. It edits `apps/web/wrangler.jsonc` the way the setup scripts do, keeping every comment. After `--apply` it runs `bun install`, `lint:fix`, `typecheck` and `lint`, marks the components `stripped` in the manifest, and prints the next steps, including the secrets to delete (it never contacts Cloudflare or GitHub).

Without `--name` and `--repo-url` (and no GitHub `origin` remote to read it from), the renames are left to you and printed. Commit the strip on its own, so the diff of what was removed stays readable.

### 3. Brand it

Give the project its own name, tagline, mark, accent, fonts and radius in `packages/ui/src/brand/`: [how-to-define-branding.md](how-to-define-branding.md). Rename the `cloudflare-starter-*` resources in `apps/web/wrangler.jsonc` (Worker, databases, buckets, queues, datasets) now, before the next step creates them.

### 4. Set up Cloudflare, auth, email, the database and secrets

Each script has `--dry-run`; run it first. Each creates or changes resources in your Cloudflare account, so read the plan before the real run.

1. Log in: `bunx wrangler login` (in `apps/web`).
2. Resources per environment, and the project's own rate-limit namespace block: `bun run setup:cloudflare --env all --dry-run`, then without `--dry-run` ([how-to-setup-web-app.md](how-to-setup-web-app.md#deploy), [how-to-setup-d1.md](how-to-setup-d1.md), [how-to-configure-abuse-protection.md](how-to-configure-abuse-protection.md#namespace-ids)). Create a Turnstile widget per deployed environment and put its site key in the vars (the script prints how).
3. Product settings per environment: `bun run setup:auth --env <env>` (sign-in methods, two-factor and passkeys, workspace mode, sign-up, billing, admin portal; a deploy refuses to start until it ran: [how-to-setup-auth.md](how-to-setup-auth.md), [how-to-configure-workspaces.md](how-to-configure-workspaces.md)), `bun run setup:analytics --env <env>`, `bun run setup:storage`.
4. Email: `bun run setup:email --env <env>` onboards the sender domain and writes `EMAIL_FROM` ([how-to-setup-email.md](how-to-setup-email.md)).
5. Database: `bun run db:migrate:local`, and per environment `bunx wrangler d1 migrations apply DB --remote --env <env>` ([how-to-setup-d1.md](how-to-setup-d1.md)).
6. Secrets: `bun run setup:secrets` (local `.dev.vars`) and `bun run setup:secrets --env <env>` (`APP_URL`, `BETTER_AUTH_SECRET`, `TURNSTILE_SECRET_KEY`, ...).
7. Domain: put the production hostname in `routes` of `env.production` (the strip left `app.example.com`) and in `SITE_URL` of `deploy:production` in `apps/web/package.json`.
8. `bun run doctor` until it is clean.

The agent skills do these steps with you: `setup-d1`, `setup-auth` and `setup-email` in `.claude/skills/`.

### 5. First deploy

```bash
bun run verify && bun run build
cd apps/web && CLOUDFLARE_ENV=production bun run deploy:dry-run   # packages without deploying
bun run deploy:production
```

Then the production smoke suite: `bun run test:smoke -- --env production` ([how-to-qa-a-deployment.md](how-to-qa-a-deployment.md)). For deploys from CI, set up the Deploy workflow and its GitHub environments: [how-to-setup-ci.md](how-to-setup-ci.md#deploy-workflow). Make yourself a platform admin with `bun run setup:admin --email <you> --remote --env production`.

### 6. Decide what the starter's pages become

The landing page at `/` still describes the starter: replace it ([how-to-publish-docs-and-landing.md](how-to-publish-docs-and-landing.md#replace-the-landing-page)). The docs at `/docs` now carry your name and repository; keep publishing them for the project's developers, point them at product docs, or remove them (same guide).

### 7. Keep or replace the placeholders

- **Notes** is the worked example: a complete feature with its table, use cases, tRPC procedures, MCP tools, pages and tests. Build the first real feature by copying its shape ([how-to-add-a-feature.md](how-to-add-a-feature.md)), then remove Notes ([Removing Notes from a project](how-to-add-a-feature.md#removing-notes-from-a-project)).
- **Tasks** is a sample board with fixed data; strip it when the product has its own pages: `bun run starter:strip --only tasks --apply`.
- The example plans, roles and the dashboard's getting-started steps are the starter's: replace them ([how-to-configure-plans-and-billing.md](how-to-configure-plans-and-billing.md), [how-to-configure-workspaces.md](how-to-configure-workspaces.md)).
- Record the project's performance targets ([performance.md](../architecture/performance.md#targets)) and decide which ADRs it keeps ([decisions/README.md](../decisions/README.md)). From the first real deploy, migrations are additive only.

</details>

## When the strip fails

`starter:strip` refuses to run when the manifest no longer matches the code (a patch that no longer applies, for instance); it names the component. In the starter that is a bug: report it. In your project, strip that component by hand from the manifest entry, which lists every file, setting, job and doc it touches.
