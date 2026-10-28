# How to set up CI

Two workflows live in `.github/workflows/`:

- `ci.yml` runs on every pull request and on pushes to `main`.
- `deploy.yml` deploys the web app to one environment when you start it by hand.

Both use the local composite action `.github/actions/setup`, which installs Bun (the version from `packageManager` in `package.json`), restores Bun's install cache (`~/.bun/install/cache`, keyed on `bun.lock`) and runs `bun install --frozen-lockfile`. All third-party actions are pinned to a full commit SHA with the version in a comment.

## CI jobs

The jobs run in parallel. A new push to the same branch or pull request cancels the run it replaces. The workflow token is read-only (`permissions: contents: read`).

| Job          | What it checks                                                                                                                                                   | Run it locally                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `lint`       | Biome formatting and lint rules over the whole repo                                                                                                              | `bun run lint` (`bun run lint:fix` to fix)                                                        |
| `typecheck`  | `typecheck` in every package and app (`astro check` for apps), plus `scripts/`                                                                                   | `bun run typecheck`                                                                               |
| `test`       | Vitest, including the MCP parity rule (every tRPC procedure or HTTP endpoint needs an MCP tool or an exemption)                                                  | `bun run test`                                                                                    |
| `migrations` | `bun run db:generate` produces no changes in `packages/features/migrations` (migrations match the Drizzle schema), and the migrations apply to an empty local D1 | `bun run db:generate && git status packages/features/migrations`, then `bun run db:migrate:local` |
| `build`      | Production builds of the web app and Storybook                                                                                                                   | `bun run build`                                                                                   |

`bun run verify` runs lint, typecheck and test in one go. It is the quickest check before you push.

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

## Self-hosted runner

By default every job runs on GitHub's `ubuntu-latest`. You can register your own machine as a runner and point CI at it with one repository variable.

### When it is worth it

- You run out of free GitHub Actions minutes (public repositories get them free on standard runners, private ones have a monthly quota).
- Your machine is much faster than a hosted runner and you want shorter feedback.

It is not worth it if the machine is often asleep or offline: jobs then wait in the queue until it comes back (up to 24 hours, after which GitHub fails them). One runner runs one job at a time, so the five CI jobs run one after another. Register a second runner (another `--name` and `--dir`) if you want them in parallel.

### The risk with a public repository

A self-hosted runner runs whatever code the job checks out, as your user, on your machine. In a public repository anyone can open a pull request from a fork. If that ran on your runner, a stranger could read your files, SSH keys and tokens.

How this repository handles it:

- Every CI job picks its runner with:

  ```yaml
  runs-on: ${{ (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name != github.repository && 'ubuntu-latest') || fromJSON(vars.CI_RUNS_ON || '"ubuntu-latest"') }}
  ```

  A pull request whose branch is not in this repository (a fork, or a deleted fork) always runs on `ubuntu-latest`, whatever `CI_RUNS_ON` says.
- The deploy workflow only starts by hand (`workflow_dispatch`), which needs write access.
- No workflow uses `pull_request_target`. Do not add one that runs on the self-hosted runner, and do not add jobs that check out fork code there.

Also keep **Settings → Actions → General → Fork pull request workflows** on "Require approval for all external contributors". People with write access can still run code on your runner by pushing a branch; only give write access to people you trust with your machine.

### Set it up

Requirements: macOS or Linux (x64 or arm64), `gh` signed in with admin access to the repository, `curl` and `tar`.

```sh
bun run setup:github-runner --dry-run   # shows the plan, changes nothing
bun run setup:github-runner
```

The script:

1. Reads the repository from `git remote get-url origin` (override with `--repo owner/name`).
2. Downloads the latest [actions/runner](https://github.com/actions/runner/releases) release for your OS and architecture into `~/actions-runner/<repo>` (`--dir`), and checks its SHA-256 against the checksum in the release notes. If there is no checksum or it does not match, it stops.
3. Gets a one-hour registration token from GitHub and runs `./config.sh` with name `<hostname>-<repo>` (`--name`) and label `cloudflare-starter` (`--labels a,b`). The token is never printed.
4. Installs and starts the runner as a service (launchd on macOS). On Linux the service needs root, so the script prints the `sudo ./svc.sh install && sudo ./svc.sh start` command for you to run.

Check the runner under **Settings → Actions → Runners** (`https://github.com/<owner>/<repo>/settings/actions/runners`). It should show as Idle with the labels `self-hosted`, your OS and arch, and `cloudflare-starter`.

### Switch CI to it

```sh
gh variable set CI_RUNS_ON --body '["self-hosted","cloudflare-starter"]'
```

The value is JSON: a string for one label (`"ubuntu-latest"`) or an array of labels that a runner must all have. Back to GitHub-hosted runners:

```sh
gh variable delete CI_RUNS_ON
```

The variable is read when a run starts, so no YAML change is needed. The deploy workflow uses the same variable. Deploying from your machine is fine because the Cloudflare secrets are only given to that job, but remember the runner then sees them.

### Remove it

```sh
gh variable delete CI_RUNS_ON          # first, or jobs queue forever
bun run setup:github-runner --remove
```

This stops and uninstalls the service (on Linux it prints the sudo commands; run them, then run `--remove` again) and unregisters the runner with a removal token. The files stay in `~/actions-runner/<repo>`; delete the folder yourself afterwards.

## Troubleshooting

**Jobs stay "Queued" / "Waiting for a runner".** `CI_RUNS_ON` points at labels no online runner has. Check the runner is Idle in Settings → Actions → Runners, that its labels include every label in the variable, and that the machine is awake. `gh variable delete CI_RUNS_ON` gets you back to hosted runners.

**`bun install --frozen-lockfile` fails.** `bun.lock` does not match `package.json`. Run `bun install` locally and commit the lockfile.

**`migrations` fails with changes in `packages/features/migrations`.** The schema changed without a migration. Run `bun run db:generate` and commit the new files.

**A job passes on the self-hosted runner but fails on GitHub (or the reverse).** The runner uses whatever is installed on your machine apart from Bun (Node, git, system libraries). Compare versions, or run the job on hosted runners to confirm.

**Runner offline after a reboot (Linux).** The service was not installed. Run the `sudo ./svc.sh install && sudo ./svc.sh start` lines from the setup output in the runner folder.

**`setup:github-runner` says the folder already holds a runner.** Run it with `--remove` first, or pick another `--dir` and `--name`.

**Runner shows in GitHub but the folder is gone.** Delete it in Settings → Actions → Runners (… → Remove runner).

**Deploy fails with "Authentication error [code: 10000]".** The token lacks a permission for that step (D1 for migrations, Workers Scripts or R2 for deploy) or is scoped to a different account than `CLOUDFLARE_ACCOUNT_ID`.

**Deploy waits for approval.** The environment has required reviewers. Approve it on the run page.
