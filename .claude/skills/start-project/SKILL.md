---

name: start-project
description: Turn a fresh copy of this template into the owner's own project — ask the owner the decisions it needs, run `bun run starter:strip` to remove the starter-only parts (its QA automation, production values, marketing, name, demos, Container demo), then walk the setup skills (D1, auth, email), secrets and the first deploy. Use when the user created a repository from the starter and asks to start, set up, or make it their own, or asks what starter:strip removes.
---

# Start a project from the starter

The flow of `docs/guides/how-to-start-a-project.md`, done with the owner. The starter-only parts and why each exists are in `starter-only.json`; `bun run starter:strip --list` prints them with their status and default.

## Before anything

1. Check where you are: `git remote get-url origin`. If it is still `flooper68/cloudflare-starter`, stop: this is the starter itself, and stripping it would delete its own QA and demos. Ask the owner to create a repository from the template first (GitHub **Use this template**, or `gh repo create <owner>/<name> --template flooper68/cloudflare-starter --private --clone`; creating a repository is their action, not yours).
2. `bun install`, then `bun run verify` so you know the copy was green before you changed anything.

## Ask the owner (one batch)

Ask only these, each with the recommended answer so they can say "yes":

1. **Project name** (for `--name`): the product's name, shown in page titles, mails, the authenticator app, passkeys, the MCP server and the docs. No default; without it the renames are left as next steps.
2. **Repository URL** (for `--repo-url`): defaults to the `origin` remote on GitHub; confirm it.
3. **What to strip.** Recommend the defaults: strip `qa-automation`, `production-instance`, `marketing`, `brand-name`, `developer-demos`, `containers`, `starter-repo`; keep `tasks` and `notes`. Ask whether they want the Container demo (`--keep containers`) or the developer demos (`--keep developer-demos`), and whether Tasks can go (`--only` with `tasks` added).

Pending components (their PRs have not landed on the starter) are skipped by the script; mention them only if the owner asks.

## Strip

1. Dry run, and show the owner the plan (the list of files and settings it changes):
   `bun run starter:strip --yes --name "<name>" --repo-url <url> [--keep <ids>] [--only <ids>]`
2. On the owner's yes, the same command with `--apply`. It runs `bun install`, `lint:fix`, `typecheck` and `lint` and prints the next steps. A failure there is a bug in the starter's manifest: report the command and the error to the owner; do not hand-edit around it silently.
3. Run it once more without `--apply`: it must say `0 change(s)`.
4. `bun run verify && bun run build`, then commit the strip on its own (on the owner's yes), so its diff stays reviewable.
5. Tell the owner the next steps the script printed. Secrets it lists (`QA_TOKEN`, the GitHub `qa` environment) only exist if their account ran the starter's QA; deleting them is their action.

## Set up (the other skills)

Each step changes the owner's Cloudflare account: dry-run first, show the plan, get a yes per step.

1. Brand: name, tagline, mark, accent, fonts, radius in `packages/ui/src/brand/` (`docs/guides/how-to-define-branding.md`). Rename the `cloudflare-starter-*` resources in `apps/web/wrangler.jsonc` before they are created.
2. Database and resources: the `setup-d1` skill (`bun run setup:cloudflare --env <env>`, which also gives the project its own rate-limit namespace block).
3. Auth and product settings: the `setup-auth` skill (`bun run setup:auth --env <env>`; a deploy refuses to start until it ran), then `bun run setup:analytics --env <env>` and `bun run setup:storage`.
4. Email: the `setup-email` skill (`bun run setup:email --env <env>`).
5. Secrets: the owner runs `bun run setup:secrets --env <env>` and types them; never handle secret values yourself.
6. Domain: the production hostname in `routes` of `env.production` (the strip left `app.example.com`) and `SITE_URL` in `deploy:production` (`apps/web/package.json`).
7. `bun run doctor` until clean.

## First deploy

`bun run verify && bun run build`, `cd apps/web && CLOUDFLARE_ENV=production bun run deploy:dry-run`, then, on the owner's explicit yes, `bun run deploy:production` and `bun run test:smoke -- --env production`. CI deploys: `docs/guides/how-to-setup-ci.md`.

## Afterwards

Notes stays as the pattern for the first real feature (`docs/guides/how-to-add-a-feature.md`); remove it once that feature exists. The landing page still describes the starter: replace it (`docs/guides/how-to-publish-docs-and-landing.md#replace-the-landing-page`).

## Verify

`bun run starter:strip --yes` reports `0 change(s)`; `bun run verify`, `bun run build` and `bun run doctor` pass.
