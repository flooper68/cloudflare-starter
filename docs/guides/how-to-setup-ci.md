# How to set up CI

Two workflows live in `.github/workflows/`:

- `ci.yml` runs on every pull request and on pushes to `main`.
- `deploy.yml` deploys the web app to one environment when you start it by hand.

Both use the local composite action `.github/actions/setup`, which installs Bun (the version from `packageManager` in `package.json`), restores Bun's install cache (`~/.bun/install/cache`, keyed on `bun.lock`; on GitHub-hosted runners only, see [Self-hosted runners](#self-hosted-runners)) and runs `bun install --frozen-lockfile`. All third-party actions are pinned to a full commit SHA with the version in a comment.

## CI jobs

The jobs run in parallel. A new push to the same branch or pull request cancels the run it replaces. The workflow token is read-only (`permissions: contents: read`).

| Job              | What it checks                                                                                                                                                                                                                                                                                                                             | Run it locally                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `lint`           | Biome (incl. GritQL rules) and dependency-cruiser; on pull requests also that no commit credits an AI agent                                                                                                                                                                                                                                | `bun run lint` (`bun run lint:fix` to fix), `bun scripts/check-attribution.ts`                    |
| `typecheck`      | `typecheck` in every package and app (`astro check` for apps), plus `scripts/`                                                                                                                                                                                                                                                             | `bun run typecheck`                                                                               |
| `test`           | Vitest: unit, integration and API tests (real local D1 in workerd), architecture tests, MCP parity                                                                                                                                                                                                                                         | `bun run test`                                                                                    |
| `components`     | Installs Chromium for the pinned Playwright (`scripts/ci-playwright-install.ts`) and runs every Storybook story as a test in it, in both themes: renders, passes axe (any accessibility violation fails), runs its `play` interaction test                                                                                                 | `bun run test:components` (once: `cd apps/web && bunx playwright install chromium`)               |
| `e2e`            | Copies `.dev.vars.example` to `.dev.vars`, migrates the local D1, runs the Playwright journeys against `astro dev` (Playwright starts and stops it). On failure it uploads the HTML report, traces and videos as the `playwright-report` artifact. The test command runs through `scripts/ci-reap.ts`, which stops dev servers left behind | `bun run db:migrate:local && bun run test:e2e`                                                    |
| `migrations`     | `bun run db:generate` produces no changes in `packages/features/migrations` (migrations match the Drizzle schema), and the migrations apply to an empty local D1                                                                                                                                                                           | `bun run db:generate && git status packages/features/migrations`, then `bun run db:migrate:local` |
| `build`          | Production builds of the web app and Storybook                                                                                                                                                                                                                                                                                             | `bun run build`                                                                                   |
| `deploy-dry-run` | For develop, staging and production: builds the web Worker for that environment and runs `wrangler deploy --dry-run`, which validates `wrangler.jsonc`, the bindings and the bundle without deploying. Needs no Cloudflare account (a placeholder token stops Wrangler asking to log in)                                                   | `cd apps/web && CLOUDFLARE_ENV=staging bun run deploy:dry-run` (no `CLOUDFLARE_ENV` for develop)  |

`bun run verify` runs lint, typecheck and test in one go. It is the quickest check before you push; add `bun run test:components` after UI changes and `bun run test:e2e` after changes to auth, pages or routes (see [testing.md](../architecture/testing.md)).

On GitHub-hosted runners the `components` and `e2e` jobs download Chromium (about 150 MB) and install its Ubuntu packages (`playwright install --with-deps chromium`) on every run. The self-hosted runner image has the packages, and each worker keeps the browser between jobs.

The `migrations` job copies `apps/web/.dev.vars.example` to `apps/web/.dev.vars` because Wrangler expects the file. No Cloudflare account is needed: `--local` uses a SQLite file under `apps/web/.wrangler/`.

## Deploy workflow

`deploy.yml` deploys the web app to `develop`, `staging` or `production`. Start it from **Actions → Deploy → Run workflow**, or:

```sh
gh workflow run deploy.yml -f environment=staging
```

It runs `bun run verify`, applies the D1 migrations to that environment's remote database (`wrangler d1 migrations apply DB --remote [--env <env>]`), then runs `bun run deploy`, `deploy:staging` or `deploy:production` in `apps/web`. Only one deploy per environment runs at a time; a second one waits.

It does not deploy Storybook or the container app, and it does not set Worker secrets. Set those once with `bun run setup:secrets --env <env>` (see [how-to-setup-auth.md](how-to-setup-auth.md)).

### 1. Create the GitHub environments

The job runs in the GitHub environment named like the input, so each environment has its own secrets and protection rules.

1. Repository **Settings → Environments → New environment**. Create `develop`, `staging` and `production`.
2. For `production`, add **Required reviewers** (yourself is fine: the run then waits for a click) and, under **Deployment branches and tags**, allow only `main`. Consider the same branch rule for `staging`.

Or from the terminal (creates the environments without rules):

```sh
for env in develop staging production; do
  gh api -X PUT "repos/{owner}/{repo}/environments/$env"
done
```

### 2. Create a Cloudflare API token

In the Cloudflare dashboard: **My Profile → API Tokens → Create Token → Create Custom Token**. Give it these account permissions, limited to your account:

| Permission                          | Why                                          |
| ----------------------------------- | -------------------------------------------- |
| Account · Workers Scripts · Edit    | upload the Worker (`wrangler deploy`)        |
| Account · D1 · Edit                 | apply remote migrations                      |
| Account · Workers R2 Storage · Edit | the Worker's R2 binding (`FILES`)            |
| Account · Account Settings · Read   | Wrangler reads account details during deploy |

Add **Zone · Workers Routes · Edit** for the zone if you deploy to a route or custom domain. Some dashboards show `Write` instead of `Edit`; they are the same thing. One token per environment is safer than one shared token, but one token works.

Permission names: <https://developers.cloudflare.com/fundamentals/api/reference/permissions/>. Cloudflare's guide for GitHub Actions: <https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/>.

If a deploy fails with an authentication error (code 10000) on a step, the token is missing the permission for that resource. Add it and run again.

### 3. Add the secrets to each environment

Each environment needs two secrets:

- `CLOUDFLARE_API_TOKEN`: the token from step 2.
- `CLOUDFLARE_ACCOUNT_ID`: your account id (dashboard → Workers & Pages, right column, or `bunx wrangler whoami`).

```sh
gh secret set CLOUDFLARE_API_TOKEN --env production   # prompts for the value
gh secret set CLOUDFLARE_ACCOUNT_ID --env production
```

Repeat for `develop` and `staging`. Do not pass the token with `--body`; it ends up in your shell history. The workflow only exposes the secrets to the two Wrangler steps, and GitHub masks them in logs.

## Self-hosted runners

By default every job runs on GitHub's `ubuntu-latest`. You can run your own runners on a machine with Docker and point CI at them with one repository variable. Each runner ("worker") is a container built from `ops/runner/Dockerfile`, running one job at a time; you choose how many.

### When it is worth it

- You run out of free GitHub Actions minutes (public repositories get them free on standard runners, private ones have a monthly quota).
- Your machine is much faster than a hosted runner and you want shorter feedback.

It is not worth it if the machine is often asleep or offline: jobs then wait in the queue until a runner is back (up to 24 hours, after which GitHub fails them). CI has eight jobs (ten with the deploy dry-run matrix); with one worker they run one after another, with four they finish in roughly a third of the time if the machine has the CPUs for it.

### Security

A self-hosted runner runs whatever code a job checks out. **This repository is public**: anyone can open a pull request from a fork, and if that ran on your runner, a stranger's code would run on your machine. The setup is safe only while all of these hold:

- **Fork pull requests never reach a self-hosted runner.** Every CI job picks its runner with:

  ```yaml
  runs-on: ${{ (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository && 'ubuntu-latest') || fromJSON(vars.CI_RUNS_ON || '"ubuntu-latest"') }}
  ```

  A pull request whose branch is not in this repository (a fork, or a deleted fork) always runs on `ubuntu-latest`, whatever `CI_RUNS_ON` says. `test/architecture/ci.test.ts` fails if a job in `ci.yml` lacks this expression.
- **No `pull_request_target`.** That trigger runs with the base repository's secrets and permissions; with fork code on a self-hosted runner it hands your machine to anyone. No workflow uses it, and `test/architecture/ci.test.ts` fails if one does. Do not add jobs that check out fork code on the self-hosted runners either.
- **Outside contributors need approval.** Turn on **Settings → Actions → General → Fork pull request workflows → Require approval for all external contributors**. It is a repository setting, not code; check it after creating the repository from this template.
- **Deploys only from the trusted repository.** `deploy.yml` starts only by hand (`workflow_dispatch`), which needs write access, and its secrets come from GitHub environments with their own protection rules. Only give write access to people you trust with your machine: they can run code on the runners by pushing a branch.
- **The containers have no access to the host.** No Docker socket, no host paths, no host network: a job sees only its container (its own network namespace, so a dev server it starts on `:4321` never meets yours). Anything with access to your Docker daemon can still read a running job's environment, including the deploy secrets while a deploy runs.
- **The registration token never reaches a job.** `runner:up` fetches a one-hour registration token with your `gh` session and passes it only in the environment of a throwaway `register` container (`docker compose run --rm`), which hands it to `config.sh` as `ACTIONS_RUNNER_INPUT_TOKEN`: never on a command line, in a file or in the long-running container. It is never printed.

Why persistent and not ephemeral runners: an ephemeral runner registers again for every job, so the machine needs a fresh registration token per job, which only an admin token (a personal access token or GitHub App with administration rights on the repository) can mint. That token would have to live on the machine, next to the jobs. A persistent registration needs the admin rights only once, from your own `gh`, and keeps just the runner's own credentials (`.runner`, `.credentials`) in the worker's volume. Between jobs `actions/checkout` cleans the workspace and the runner wipes `RUNNER_TEMP`; caches in the container (Bun's install cache, the tool cache, Playwright's browser) persist, which is what makes the runners fast.

### Requirements

- Docker: Docker Desktop on macOS or Windows, or Docker Engine with the Compose plugin on Linux. The image is `linux/arm64` on Apple Silicon and `linux/amd64` elsewhere; every native package the jobs use has builds for both.
- Docker Desktop resources (Settings → Resources): about **2 CPUs and 3 GB of memory per worker** (the `e2e` and `components` jobs run workerd and Chromium), and about 2 GB of disk for the image plus a few GB per worker for its caches (Bun's install cache, `node_modules`, Chromium).
- `gh` signed in (`gh auth login`) with admin access to the repository, only while registering or removing workers.

### Start, scale, stop

```sh
bun run runner:up -- --workers 2 --dry-run   # shows the plan, changes nothing
bun run runner:up -- --workers 2
```

`runner:up`:

1. Reads the repository from `git remote get-url origin` (override with `--repo owner/name`) and checks that `ops/runner/Dockerfile` pins the same Bun (`packageManager`), Node (`.nvmrc`) and Playwright (`apps/web`) as the repository.
2. Builds the image `<owner>-<repo>-runner:local` from `ops/runner/Dockerfile`: the official [actions-runner](https://github.com/actions/runner/pkgs/container/actions-runner) image (pinned by version and digest), plus Bun and Node (each checked against a SHA-256 in the Dockerfile) and Chromium's Ubuntu packages for the pinned Playwright.
3. For each worker whose volume holds no registration yet, registers it (one registration token for all of them) as `<hostname>-<repo>-<n>` with the labels `self-hosted`, `Linux`, the architecture, and `<repo>` (`--labels a,b` replaces `<repo>`). A registered worker keeps its name even if the hostname changes later; registration never replaces an existing runner of the same name.
4. Starts workers 1 to n, one Compose project each (`ops/runner/docker-compose.yml`): container `<owner>-<repo>-runner-<n>`, volume `<owner>-<repo>-runner-<n>-state`, `restart: unless-stopped`, `init: true` (reaps processes a job leaves behind), `shm_size: 2g` (Chromium).
5. Stops any running worker above n. It stays registered and shows as Offline in GitHub; a later `--workers` that includes it starts it again without registering.

Check the workers under **Settings → Actions → Runners** (`https://github.com/<owner>/<repo>/settings/actions/runners`): each shows as Idle.

| Command                                              | What it does                                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `bun run runner:up -- --workers <n>`                 | Builds the image, registers new workers, starts 1..n, stops the rest. Run it again to scale, or after a rebuild       |
| `bun run runner:down`                                | Stops every worker; they keep their registration and stay stopped across Docker restarts. Queued jobs wait until `up` |
| `bun run runner:logs [-- --worker <n>]`              | Follows the workers' logs (all, or the given ones)                                                                    |
| `bun run runner:remove -- --worker <n>` / `-- --all` | Stops the worker, deletes it in GitHub (admin `gh`), deletes its container and volume                                 |

All of them take `--dry-run` (except `logs`). A job that is running when its worker stops fails; re-run it. Labels are set at registration: to change them, `runner:remove -- --all` and `runner:up` again.

### Switch CI to them

```sh
gh variable set CI_RUNS_ON --body '["self-hosted","cloudflare-starter"]'
```

The value is JSON: a string for one label (`"ubuntu-latest"`) or an array of labels that a runner must all have; use your repository name in place of `cloudflare-starter` (`runner:up` prints the exact command). Back to GitHub-hosted runners:

```sh
gh variable delete CI_RUNS_ON
```

The variable is read when a run starts, so no YAML change is needed. `deploy.yml` uses the same variable (without the fork guard: it only starts by hand). Set the variable only while workers are up, or jobs wait in the queue.

On a self-hosted runner (`runner.environment != 'github-hosted'`) the workflows behave slightly differently, and must keep doing so:

- The GitHub cache is skipped: the `actions/cache` step and setup-bun's cache only run on GitHub-hosted runners (`test/architecture/ci.test.ts` checks every `actions/cache` step). The container keeps those files itself, and cache uploads from a self-hosted machine are slow or hang.
- `scripts/ci-playwright-install.ts` installs only the Chromium browser when the image has the OS packages for this commit's Playwright (`CI_RUNNER_IMAGE_PLAYWRIGHT`). After a Playwright upgrade it installs them in the job (sudo apt-get) and prints a warning until the image is rebuilt.
- `scripts/ci-reap.ts` wraps the Storybook and Playwright test commands: afterwards it stops workerd, wrangler, astro, vite and other processes started from the workspace's `node_modules`, which would otherwise keep the step's output open until the job times out. It only acts when `GITHUB_ACTIONS=true`, and only on processes whose command line contains `GITHUB_WORKSPACE`; each worker runs one job at a time, so they are that job's.

### Upgrades

- **Runner version**: bump the `FROM ghcr.io/actions/actions-runner:<version>@sha256:<digest>` line in `ops/runner/Dockerfile` (the digest of the multi-arch index: `docker buildx imagetools inspect ghcr.io/actions/actions-runner:<version>`) in a PR, then `bun run runner:up -- --workers <n>`. The runner also updates itself inside a running container when GitHub releases a new version; that update is lost when the container is recreated, so keep the pin current. GitHub stops sending jobs to runners that fall too far behind.
- **Bun or Node**: change `packageManager` or `.nvmrc`, then `BUN_VERSION` or `NODE_VERSION` and both SHA-256 lines in the Dockerfile (from `https://github.com/oven-sh/bun/releases/download/bun-v<version>/SHASUMS256.txt` and `https://nodejs.org/dist/v<version>/SHASUMS256.txt`). `test/architecture/ci.test.ts` fails until they match.
- **Playwright**: change `PLAYWRIGHT_VERSION` with the Playwright packages; after merging, `runner:up` rebuilds the image. Until then the jobs install the OS packages themselves and warn.
- `runner:up` recreates a worker's container when the image changed; the registration in its volume is kept.

### Remove them

```sh
gh variable delete CI_RUNS_ON          # first, or jobs queue forever
bun run runner:remove -- --all
```

This stops each worker, deletes it in GitHub (`gh api -X DELETE repos/<owner>/<repo>/actions/runners/<id>`, with the id from the registration in the worker's volume, so a changed hostname does not matter), and removes its container, network and volume. The image stays; delete it with `docker image rm <owner>-<repo>-runner:local`.

## Troubleshooting

**Jobs stay "Queued" / "Waiting for a runner".** `CI_RUNS_ON` points at labels no online runner has. Check that the workers are Idle in Settings → Actions → Runners, that their labels include every label in the variable, that `docker ps` shows them and that the machine is awake (`bun run runner:up -- --workers <n>`). `gh variable delete CI_RUNS_ON` gets you back to hosted runners.

**`bun install --frozen-lockfile` fails.** `bun.lock` does not match `package.json`. Run `bun install` locally and commit the lockfile.

**`migrations` fails with changes in `packages/features/migrations`.** The schema changed without a migration. Run `bun run db:generate` and commit the new files.

**A job passes on the self-hosted runner but fails on GitHub (or the reverse).** The workers run Ubuntu from the actions-runner image, with what `ops/runner/Dockerfile` adds; `ubuntu-latest` has many more tools preinstalled, and on Apple Silicon the workers are `arm64`. Run the job on hosted runners to confirm, and add a missing tool to the Dockerfile.

**`runner:up` says `ops/runner/Dockerfile is out of date`.** Bun, Node or Playwright changed in the repository but not in the Dockerfile. Update the `ARG` (and for Bun and Node both SHA-256 lines), see [Upgrades](#upgrades).

**`runner:up` says Docker is not running.** Start Docker Desktop (or the Docker daemon) and run it again.

**A worker restarts in a loop, its log says `not registered` or the runner rejects its credentials.** The registration in its volume is missing or was deleted in GitHub. `bun run runner:remove -- --worker <n>`, then `runner:up` registers it again.

**Registering fails because a runner with that name already exists.** Another machine with the same short hostname registered workers for this repository (names are `<hostname>-<repo>-<n>`). Registration never replaces an existing runner; rename one machine, or remove the stale runner in Settings → Actions → Runners if it is gone.

**A worker shows in GitHub as Offline but no longer exists on any machine.** Delete it in Settings → Actions → Runners (… → Remove runner). Stopped workers above the `--workers` count also show as Offline; `runner:remove -- --worker <n>` unregisters them.

**A job waits after "N passed" until it times out.** A process the tests started still holds the step's output. The test steps run through `scripts/ci-reap.ts`; if a new step starts a dev server, wrap it too.

**`components` or `e2e` warns that the runner image has OS packages for another Playwright.** The image was built before a Playwright upgrade. The job installs the packages itself; `bun run runner:up -- --workers <n>` rebuilds the image.

**A job runs out of memory or Chromium crashes.** Give Docker Desktop more memory (about 3 GB per worker) or run fewer workers.

**Deploy fails with "Authentication error [code: 10000]".** The token lacks a permission for that step (D1 for migrations, Workers Scripts or R2 for deploy) or is scoped to a different account than `CLOUDFLARE_ACCOUNT_ID`.

**Deploy waits for approval.** The environment has required reviewers. Approve it on the run page.
