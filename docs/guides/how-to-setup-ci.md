# How to set up CI

::reviewed{date="2026-11-09"}

Every pull request runs the full check suite (`ci.yml`: lint, types, tests, components, browser journeys, the build with its bundle budget, and dry-run deploys of every environment), and a deploy workflow (`deploy.yml`) ships one environment when you start it by hand. Use this guide to set up deploys from GitHub, or to run CI on your own machines.

::flow[Pull request -> CI checks -> Merge -> Deploy by hand -> Smoke and QA]{title="Release flow: a pull request passes CI, is merged, deployed by hand, then checked by the smoke and QA suites"}

## Set up the deploy workflow

:::prompt{title="Paste this into your coding agent"}
```text
Set up the Deploy workflow for develop, staging and production: create the GitHub
environments (production with me as required reviewer, main only), tell me exactly which
Cloudflare API token permissions to create, then set CLOUDFLARE_API_TOKEN and
CLOUDFLARE_ACCOUNT_ID in each environment with gh. Ask before each change.
```
:::

:::byhand
1. **GitHub environments** `develop`, `staging`, `production` (Settings › Environments); for production, required reviewers and deployment branch `main` only.
2. **A Cloudflare API token** with Account · Workers Scripts · Edit, D1 · Edit, Workers R2 Storage · Edit, Containers · Edit (the pi container's image) and Account Settings · Read (plus Zone · Workers Routes · Edit for a custom domain).
3. **Two secrets per environment:** `gh secret set CLOUDFLARE_API_TOKEN --env production` and `gh secret set CLOUDFLARE_ACCOUNT_ID --env production` (prompted, never `--body`).
   :::

Then deploy: **Actions › Deploy › Run workflow**, or `gh workflow run deploy.yml -f environment=staging`. It verifies, migrates the remote database and deploys; the smoke suite runs after it.

:::gotcha{title="The workflow sets no Worker secrets"}
Set them once per environment with `bun run setup:secrets --env <env>`, and choose the workspace, sign-up and billing settings with `bun run setup:auth` before the first deploy.
:::

## Run CI on your own machines (optional)

A local GitHub Actions runner comes ready: self-hosted runners in Docker (`ops/runner`, `bun run runner:up -- --workers <n>`) make CI faster and free of GitHub minutes. They are optional; without them every job runs on GitHub's hosted runners. Switch with the repository variable `CI_RUNS_ON`; pull requests from forks always stay on GitHub-hosted runners.

:::decision{title="Forks never reach your machine"}
The repository is public and a fork's pull request runs code its author wrote, so every job keeps a fork guard and no workflow uses `pull_request_target`. `test/architecture/ci.test.ts` checks both.
:::

## Reference

Every CI job, the deploy workflow in detail, the QA environment, self-hosted runners (security, requirements, scaling, upgrades, removal) and troubleshooting: [CI reference](../reference/ci.md).
