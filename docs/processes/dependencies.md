# Dependencies

How dependencies are updated, audited for security and added: when to do it, the commands, what else besides `package.json` goes stale, how to triage an advisory, and what a PR that touches dependencies must show. Nothing here runs on its own; the project decides the cadence and who does it. Use when you update dependencies, respond to a security advisory, run an audit, or add a new package.

## When

| Trigger                      | What to do                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Regular update pass          | At a cadence the project chooses (for example every two to four weeks): [update](#update), [audit](#security-audit), and check the [non-package versions](#not-in-packagejson) |
| Security advisory            | Straight away, outside the cadence: [triage](#triage-a-finding) the finding and [fix](#fix-paths) it; for a reachable runtime issue follow [In production](#in-production)     |
| New project from the starter | Update and pin everything first, per step 1 of [Starting a new project](../../README.md#starting-a-new-project-from-this-starter); then audit                                  |
| A change needs a new package | [Adding a dependency](#adding-a-dependency)                                                                                                                                    |

## Update

Versions are pinned exactly: [bunfig.toml](../../bunfig.toml) sets `exact = true`, so `bun add` and `bun update` write no `^`/`~` ([CLAUDE.md](../../CLAUDE.md) rule 8, enforced by an architecture test). An update is therefore always an explicit diff in a `package.json` and `bun.lock`.

1. See what is behind, per workspace:

   ```bash
   bun outdated --recursive          # every workspace
   bun outdated --filter=./apps/web  # one workspace
   ```

2. Group the updates:
   - **Routine** (patches and minors with nothing alarming in the changelog): one PR for the whole pass.
   - **Risky** (a major, anything with a migration guide, the framework core: Astro, Wrangler, `@cloudflare/*`, Better Auth, Drizzle, tRPC, React, Vitest, Storybook): one PR per package or tightly coupled family (for example all `@storybook/*`), so a revert is cheap.
3. Update:

   ```bash
   bun update --latest --recursive                 # everything, all workspaces
   bun update --latest --filter=./packages/ui      # one workspace
   bun update --latest astro @astrojs/cloudflare   # named packages, in the current workspace
   bun update --interactive --recursive            # pick from a list
   ```

   Keep the holds named in the [README](../../README.md#starting-a-new-project-from-this-starter) (TypeScript, `packages/ui` peer ranges) until their reason is gone, then remove the note there.

4. Read the changelog and, for a major, the migration guide of each risky update. Note in the PR any breaking change that affects this code and how it was handled.
5. Regenerate what is derived from a dependency:

   | Updated                                  | Regenerate                                                                                                                                                                |
   | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Better Auth or one of its plugins        | The auth tables, per the `setup-auth` skill ([how-to-setup-auth.md](../guides/how-to-setup-auth.md)); then `bun run db:generate` if the schema moved                      |
   | Wrangler, `compatibility_date`, bindings | `cd apps/web && bun run cf-typegen` (`wrangler types`)                                                                                                                    |
   | Drizzle ORM or drizzle-kit               | `bun run db:generate`; it must produce no new migration unless the schema changed. Commit `migrations/meta/` changes ([how-to-setup-d1.md](../guides/how-to-setup-d1.md)) |

6. Verify, and record each command and result in the PR ([development.md](development.md#3-verify)):
   - `bun run verify` and `bun run build`;
   - the component tests and E2E tests, once those layers exist ([testing.md](../architecture/testing.md#known-gaps));
   - the deploy dry run for each environment (`cd apps/web && CLOUDFLARE_ENV=staging bun run deploy:dry-run`), which CI also runs;
   - for a risky update that changes runtime behaviour, a manual pass over the affected flows with `bun run dev:web`, captured as [evidence](development.md#4-evidence). A routine pass with no behaviour change states "no user-visible change" instead.

## Not in package.json

These do not show up in `bun outdated`; check them in each regular pass.

| What                       | Where                                                                                                                               | How to update                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers compatibility date | `compatibility_date` in `apps/web/wrangler.jsonc` and `apps/container/wrangler.jsonc`                                               | Move to a recent date, read the [compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) changed in between, run `cf-typegen`, verify and dry-run deploy |
| GitHub Actions             | `uses:` in `.github/workflows/` and `.github/actions/`, pinned by commit SHA with the version in a comment                          | Look up the new release's commit SHA, replace both the SHA and the comment; never switch to a tag or branch                                                                                         |
| Node                       | `.nvmrc` and `engines` in the root `package.json`                                                                                   | Change both together; CI reads `.nvmrc`                                                                                                                                                             |
| Bun                        | `packageManager` in the root `package.json`                                                                                         | Change it, run `bun install`, commit `bun.lock` if it changed; CI reads this field                                                                                                                  |
| Playwright browsers        | Installed by `playwright install`, matched to the `@playwright/test` version                                                        | Re-run `playwright install` after updating `@playwright/test`, locally and wherever CI installs browsers, once the E2E layer exists                                                                 |
| Container base image       | `FROM` in `apps/container/Dockerfile`                                                                                               | Move to a current tag of the same image; rebuild and run the container demo ([how-to-setup-container.md](../guides/how-to-setup-container.md))                                                      |
| Self-hosted runner         | The machine set up by `setup:github-runner` ([how-to-setup-ci.md](../guides/how-to-setup-ci.md#self-hosted-runner)), if one is used | Keep the runner release, the OS and the tools on that machine updated; GitHub refuses runners that fall too far behind                                                                              |

## Security audit

```bash
bun audit                         # all advisories for installed packages
bun audit --audit-level=high      # only high and critical
bun audit --json                  # machine-readable, for a PR comment or a script
bun audit --ignore=CVE-2026-12345 # leave out an accepted advisory (record why, below)
```

Run it in every regular pass, after any change to `bun.lock`, and when an advisory is announced for a package you use. These are the flags of Bun 1.3; check `bun audit --help` after a Bun update.

### Triage a finding

For each advisory, answer in order and write the answers in the PR or issue:

1. **Is the vulnerable version installed?** `bun why <package>` shows which dependency pulls it in and at what version.
2. **Where does it run?** Code bundled into the Worker or the browser (runtime) matters most. Build tools, test runners, linters and Storybook only run on developer machines and CI: still fix them, but they do not reach users.
3. **Is the vulnerable code reachable?** Read the advisory: which function, which input. A ReDoS in a CLI argument parser used only by a build script is not reachable by a request; a prototype-pollution bug in a body parser used by a route is.
4. **What is the impact if exploited?** Data exposure, auth bypass, denial of service, or none in this setup (for example a Node-only `fs` issue in code that runs in workerd).

Severity in this repo follows the [code-review severities](code-review.md#severities): a reachable runtime vulnerability is Critical or High and is fixed before anything else ships.

### Fix paths

Prefer them in this order:

1. **Update** the direct dependency to a version that pulls in the fixed one (`bun update <package> --latest`), or the transitive one if a compatible fixed version exists (`bun update <transitive>`).
2. **Override** the transitive version when the direct dependency has not released a fix: add it to `overrides` in the root `package.json` (Bun also reads `resolutions`), pinned exactly. Add a line to the PR saying why, which advisory, and when to remove it (for example "remove once `<direct>` depends on `<transitive>` ≥ x.y.z"). Re-check every override in each regular pass and remove the ones whose reason is gone.
3. **Replace** the package with a maintained alternative, or with a few lines of our own code, when it is unmaintained or keeps having advisories.
4. **Accept** only an advisory that is not reachable in this setup, with the triage answers recorded in the PR and a `bun audit --ignore=<id>` noted there; the owner accepts it, as with a Medium or Low review finding. Re-check accepted advisories in each pass.

### In production

When a vulnerability is reachable in a deployed Worker:

1. Fix it on a branch with the smallest change (usually an update or an override), verify, and get the owner's yes to ship ([development.md](development.md#7-ship)).
2. Deploy to staging, check the affected flow, then deploy to production ([how-to-setup-ci.md](../guides/how-to-setup-ci.md)).
3. If secrets or user data may have been exposed, rotate the affected secrets (`bun run setup:secrets --env <env>`) and tell the owner what was exposed and for how long.
4. Record what happened, the advisory, and the fix in the PR description.

## Supply chain

- **Fewer dependencies.** Each one is code that runs with our permissions and a source of future advisories. Use the platform (Web APIs, Workers APIs) or a few lines of code before a package.
- **Check before adding.** Maintenance (recent releases, open issues answered), weekly downloads, number of maintainers, transitive dependency count, bundle size if it runs in the Worker or browser, and whether it declares install scripts (`preinstall`, `install`, `postinstall`).
- **Lifecycle scripts are off by default.** Bun does not run dependencies' lifecycle scripts unless the package is listed in `trustedDependencies` in the root `package.json` (`bun add --trust <package>` adds it). Add a package there only when it does not work without its script, and say why in the PR.
- **Be wary of fresh releases.** A version published in the last few days has had little scrutiny, and compromised releases are usually caught within that window. In a routine pass, prefer a version that has been out for some days; take a fresh one when it is the security fix.
- **The lockfile is reviewed.** `bun.lock` changes belong in the diff; an unexplained new package or changed source in it is a finding.

## Adding a dependency

`bun add <package>` in the workspace that uses it (or `bun add -d` for a dev dependency), never a range. The PR says, for each new package:

- what it is for, and why the platform or existing dependencies do not cover it;
- the checks under [Supply chain](#supply-chain): maintenance, downloads, install scripts, transitive count;
- where it runs (Worker, browser, build only) and, for runtime packages, the bundle size it adds;
- that it runs in workerd, for anything used by the Worker (Node built-ins are only partly available there).
