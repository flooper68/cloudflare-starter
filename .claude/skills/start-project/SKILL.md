---

name: start-project
description: Start the owner's own app from the cloudflare-starter template, from the start prompt alone (an empty folder is fine) — check prerequisites, create their repository from the template with gh, run `bun run starter:strip` to remove the starter-only parts (QA automation, production values, marketing, name, demos, Container demo), brand it, run the setup scripts (Cloudflare resources, auth, email, D1, secrets) and make the first deploy, asking the owner for each decision and before every account change. Use when the user pastes the start prompt, asks to create an app from the starter, or asks what starter:strip removes.
---

# Start a project from the starter

You may start from the start prompt alone, in an empty folder, with nothing cloned. The whole flow and its reasons: `docs/guides/how-to-start-a-project.md` (read it once the repository is cloned). The starter-only parts and why each exists are in `starter-only.json`.

## Rules for the whole flow

- **Ask before every account change, and list them.** Before each step that changes the owner's GitHub or Cloudflare account, show the exact list of what it will create or change (repository name and visibility; each database, bucket, queue, Turnstile widget, sender domain, DNS record, secret name, deploy) and wait for a yes. One yes covers only the list you showed.
- **Dry-run first.** Every setup script has `--dry-run`; show its plan before the real run.
- **Never handle secrets.** The owner types them into `bun run setup:secrets` or the dashboard; you never see, store or echo them. If they paste one into the chat, tell them to rotate it.
- **Logins are theirs.** You never run `gh auth login` or `wrangler login` for them or enter credentials; ask them to run it in their terminal and tell you when done.
- **Stop on surprises.** A failing check you cannot explain goes to the owner with the error, not around them.

## 1. Prerequisites (read-only)

Check, and report all of them at once:

| Check                | Command                                                                          | If missing                                                       |
| -------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Bun 1.3+             | `bun --version`                                                                  | the owner installs it (https://bun.sh)                           |
| Node 24.14.1+        | `node --version`                                                                 | the owner installs it (Astro's CLI runs on Node)                 |
| Git                  | `git --version`                                                                  | the owner installs it                                            |
| GitHub CLI signed in | `gh auth status`                                                                 | the owner runs `gh auth login`                                   |
| Wrangler logged in   | `bunx wrangler whoami` in `apps/web`, after the clone and `bun install` (step 3) | the owner runs `bunx wrangler login`; needed only from step 5 on |
| Docker               | `docker --version`                                                               | only if they keep the Container demo                             |

## 2. Ask the owner (one batch)

Each with the recommended answer, so they can reply "yes":

1. **App name** (from the prompt's `<name>`; confirm it). It becomes `--name`: page titles, mails, the authenticator app, passkeys, the MCP server, the docs title.
2. **Repository**: owner (their `gh` account or an organization), name (the app name in kebab-case), visibility (recommend private).
3. **What to strip.** Recommend the defaults: strip every default (`bun run starter:strip --list` shows them: the QA automation (suite, bypass, outbox), the production values, the marketing and home page, the name, demo mode, the developer demos, the Container demo and the repository conventions); keep `tasks` and `notes`. Ask whether they want the automated QA suite against their own deployment (`--keep qa-automation`), the Container demo (`--keep containers`) or the developer demos (`--keep developer-demos`).
4. **Production hostname** (for example `app.example.com`), or "later" (it stays a placeholder and the deploy waits).
5. **Product settings** for production: workspace mode (personal, single or multi), sign-up (open or invite), billing (off, manual, provider). `setup:auth` asks the rest.

## 3. Create the repository (account change)

1. If the current folder already holds a clone of the owner's repository made from the template (`git remote get-url origin` is not `flooper68/cloudflare-starter`), skip to step 4.
2. If the folder is a checkout of the starter itself (origin `flooper68/cloudflare-starter`), stop: never strip the starter. Work in a new empty folder instead.
3. Show the list: "create the GitHub repository `<owner>/<name>` (<visibility>) from the template flooper68/cloudflare-starter, then clone it here". On yes:
   `gh repo create <owner>/<name> --template flooper68/cloudflare-starter --<visibility> --clone`, then `cd <name>`.
4. Read `AGENTS.md` and the docs index it points to.
5. `bun install`, then `bun run verify`: the copy was green before you changed anything.

## 4. Strip the starter-only parts (local files only)

1. Dry run, and show the plan: `bun run starter:strip --yes --name "<name>" --repo-url https://github.com/<owner>/<name> [--keep <ids>] [--only <ids>]`.
2. On yes, the same command with `--apply`. It runs `bun install`, `lint:fix`, `typecheck` and `lint` and prints the next steps. A failure there is a bug in the starter's manifest: report the command and the error.
3. Run the dry run again: it must say `0 change(s)`.
4. `bun run verify && bun run build`. Commit the strip on its own (`git commit`, local), and push only on the owner's yes (it changes their repository).
5. Relay the printed next steps. Secrets it lists (`QA_TOKEN`, the GitHub `qa` environment) exist only if their account ran the starter's QA.

## 5. Brand it (local files)

Ask for the brand or offer to keep a neutral one for now: name, tagline, mark, accent, fonts, radius in `packages/ui/src/brand/` (`docs/guides/how-to-define-branding.md`). Rename the `cloudflare-starter-*` resources in `apps/web/wrangler.jsonc` (Worker, databases, buckets, queues, datasets) to the app's kebab-case name before step 6 creates them. Verify and commit.

## 6. Set up (account changes; one list and one yes per step)

Run each with `--dry-run` first and turn its plan into the list you show.

1. Resources: the `setup-d1` skill, `bun run setup:cloudflare --env <env>` (D1, R2, queues, the D1 ids and the project's own rate-limit namespace block). Turnstile widgets are created by the owner in the dashboard (the script prints the steps); you put the site keys in the vars.
2. Auth and product settings: the `setup-auth` skill, `bun run setup:auth --env <env>` (writes the answers from step 2 into `wrangler.jsonc`; local, but a deploy refuses to start until it ran), then `bun run setup:analytics --env <env>` and `bun run setup:storage`.
3. Email: the `setup-email` skill, `bun run setup:email --env <env>` (onboards the sender domain: DNS records in their zone).
4. Database: `bun run db:migrate:local`; per environment `cd apps/web && bunx wrangler d1 migrations apply DB --remote --env <env>`.
5. Secrets: the owner runs `bun run setup:secrets --env <env>` and types them.
6. Domain: the hostname from step 2 into `routes` of `env.production` (the strip left `app.example.com`) and `SITE_URL` of `deploy:production` (`apps/web/package.json`).
7. `bun run doctor` until clean.

## 7. First deploy (account change)

`bun run verify && bun run build`, then `cd apps/web && CLOUDFLARE_ENV=production bun run deploy:dry-run` and show what it deploys (the Worker name, the route, the bindings). On yes: `bun run deploy:production`, then `bun run test:smoke -- --env production`. Make the owner a platform admin once they signed up: `bun run setup:admin --email <their email> --remote --env production` (on yes). Deploys from CI: `docs/guides/how-to-setup-ci.md` (GitHub environments and secrets: their action, or yours on a listed yes).

## 8. Hand over

Tell the owner what is left, from the strip's next steps and the guide's "Keep or replace the placeholders": Notes stays as the pattern for the first real feature (`docs/guides/how-to-add-a-feature.md`), the landing page still describes the starter (`docs/reference/docs-site.md#replace-the-landing-page`), the example plans and roles are the starter's. Offer to set up the daily dependency update and audit agent (a scheduled routine that runs the `update-dependencies` skill, `docs/processes/dependencies.md#set-up-the-daily-trigger`); creating it is their yes.

## Verify

`bun run starter:strip --yes` reports `0 change(s)`; `bun run verify`, `bun run build` and `bun run doctor` pass; the smoke suite passes against production.
