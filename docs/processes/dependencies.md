# Dependencies

How dependencies are updated, audited for security and added: the commands, what else besides `package.json` goes stale, how to triage an advisory, and what a PR that touches dependencies must show. It describes how to do the work; nothing here runs on its own. Use when you update dependencies, respond to a security advisory, run an audit, or add a new package.

## Update

Versions are pinned exactly: [bunfig.toml](../../bunfig.toml) sets `exact = true`, so `bun add` and `bun update` write no `^`/`~` ([AGENTS.md](../../AGENTS.md) rule 8, enforced by an architecture test). An update is therefore always an explicit diff in a `package.json` and `bun.lock`. A new project from the starter starts with the update in step 1 of [Starting a new project](../../README.md#starting-a-new-project-from-this-starter), then the steps below from 4 on, and an [audit](#security-audit).

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
   | Wrangler, `compatibility_date`, bindings | `@cloudflare/workers-types` as a package update; the bindings are typed by hand in `AppEnv` (`apps/web/src/server/env.ts`), so update it when a binding changes           |
   | Drizzle ORM or drizzle-kit               | `bun run db:generate`; it must produce no new migration unless the schema changed. Commit `migrations/meta/` changes ([how-to-setup-d1.md](../guides/how-to-setup-d1.md)) |

6. Verify, and record each command and result in the PR ([development.md](development.md#3-verify)):
   - `bun run verify` and `bun run build`;
   - `bun run test:components` and `bun run test:e2e` ([testing.md](../architecture/testing.md));
   - the deploy dry run for each environment (`cd apps/web && CLOUDFLARE_ENV=staging bun run deploy:dry-run`), which CI also runs;
   - for a risky update that changes runtime behaviour, a manual pass over the affected flows with `bun run dev:web`, captured as [evidence](development.md#4-evidence). A routine pass with no behaviour change states "no user-visible change" instead.

## Not in package.json

These do not show up in `bun outdated`; check them in each update pass.

| What                       | Where                                                                                                                                                                    | How to update                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers compatibility date | `compatibility_date` in `apps/web/wrangler.jsonc` and `apps/container/wrangler.jsonc`                                                                                    | Move to a recent date, read the [compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) changed in between, update `@cloudflare/workers-types` to match, verify and dry-run deploy                                                                                                     |
| GitHub Actions             | `uses:` in `.github/workflows/` and `.github/actions/`, pinned by commit SHA with the version in a comment                                                               | Look up the new release's commit SHA, replace both the SHA and the comment; never switch to a tag or branch                                                                                                                                                                                                                        |
| Node                       | `.nvmrc` and `engines` in the root `package.json`                                                                                                                        | Change both together; CI reads `.nvmrc`. Update `ops/runner/Dockerfile` too                                                                                                                                                                                                                                                        |
| Bun                        | `packageManager` in the root `package.json`                                                                                                                              | Change it, run `bun install`, commit `bun.lock` if it changed; CI reads this field. Update `ops/runner/Dockerfile` too (row below)                                                                                                                                                                                                 |
| Playwright browsers        | Installed by `playwright install`, matched to the Playwright version (`@playwright/test` in `apps/web`, `playwright` in `apps/storybook`; keep both on the same version) | Re-run `cd apps/web && bunx playwright install chromium` after updating Playwright; CI installs Chromium in each run of the `components` and `e2e` jobs; update `PLAYWRIGHT_VERSION` in `ops/runner/Dockerfile`                                                                                                                    |
| Container base image       | `FROM` in `apps/container/Dockerfile`                                                                                                                                    | Move to a current tag of the same image; rebuild and run the container demo ([how-to-setup-container.md](../guides/how-to-setup-container.md))                                                                                                                                                                                     |
| Self-hosted runner image   | `FROM` (version and digest) and the `BUN_*`, `NODE_*` and `PLAYWRIGHT_VERSION` args in `ops/runner/Dockerfile`                                                           | Move `FROM` to a current actions-runner release with its digest; keep Bun, Node and Playwright equal to the repository (with new SHA-256s), which `test/architecture/ci.test.ts` enforces; then `bun run runner:up` ([how-to-setup-ci.md](../guides/how-to-setup-ci.md#upgrades)). GitHub refuses runners that fall too far behind |

## Security audit

```bash
bun audit                         # all advisories for installed packages
bun audit --audit-level=high      # only high and critical
bun audit --json                  # machine-readable, for a PR comment or a script
bun audit --ignore=CVE-2026-12345 # leave out an accepted advisory (record why, below)
```

Run it as part of an update pass or when checking an advisory. These are the flags of Bun 1.3; check `bun audit --help` after a Bun update.

### Triage a finding

For each advisory, answer in order and write the answers in the PR or issue:

1. **Is the vulnerable version installed?** `bun why <package>` shows which dependency pulls it in and at what version.
2. **Where does it run?** Code bundled into the Worker or the browser (runtime) matters most. Build tools, test runners, linters and Storybook only run on developer machines and CI: still fix them, but they do not reach users.
3. **Is the vulnerable code reachable?** Read the advisory: which function, which input. A ReDoS in a CLI argument parser used only by a build script is not reachable by a request; a prototype-pollution bug in a body parser used by a route is.
4. **What is the impact if exploited?** Data exposure, auth bypass, denial of service, or none in this setup (for example a Node-only `fs` issue in code that runs in workerd).

Severity in this repo follows the [code-review severities](code-review.md#severities): a reachable runtime vulnerability is Critical or High and is fixed before anything else ships.

### Fix paths

Prefer them in this order:

1. **Update** the direct dependency to a version that pulls in the fixed one (`bun update <package> --latest`). This covers direct dependencies only: `bun update <transitive>` adds the package as a stray direct dependency and leaves the nested vulnerable version in `bun.lock`. A transitive version is fixed with step 2.
2. **Override** the transitive version when the direct dependency has not released a fix: add it to `overrides` in the root `package.json` (Bun also reads `resolutions`), pinned exactly. Add a row to [Overrides and accepted advisories](#overrides-and-accepted-advisories) saying which advisory and when to remove it (for example "once `<direct>` depends on `<transitive>` ≥ x.y.z"). Re-check every row in each update pass and remove the ones whose reason is gone.
3. **Replace** the package with a maintained alternative, or with a few lines of our own code, when it is unmaintained or keeps having advisories.
4. **Accept** only an advisory that is not reachable in this setup, with the triage answers in the PR and a row in [Overrides and accepted advisories](#overrides-and-accepted-advisories) (pass its id to `bun audit --ignore=<id>`); the owner accepts it, as with a Medium or Low review finding. Re-check accepted advisories in each update pass.

### Overrides and accepted advisories

Each project records here every `overrides`/`resolutions` entry and every accepted advisory, so the next update pass knows why it exists and when it can go (replace the placeholder row).

| Advisory id or package | Kind | Reason | Remove when |
| ---------------------- | ---- | ------ | ----------- |
| _none in the starter_  |      |        |             |

### In production

When a vulnerability is reachable in a deployed Worker:

1. Fix it on a branch with the smallest change (usually an update or an override), verify, and get the owner's yes to ship ([development.md](development.md#7-ship)).
2. Deploy to staging, check the affected flow, then deploy to production ([how-to-setup-ci.md](../guides/how-to-setup-ci.md)).
3. If secrets or user data may have been exposed, rotate the affected secrets (`bun run setup:secrets --env <env>`) and tell the owner what was exposed and for how long.
4. Record what happened, the advisory, and the fix in the PR description.

## Supply chain

- **Fewer dependencies.** Each one is code that runs with our permissions and a source of future advisories. Use the platform (Web APIs, Workers APIs) or a few lines of code before a package.
- **Check before adding.** Maintenance (recent releases, open issues answered), weekly downloads, number of maintainers, transitive dependency count, bundle size if it runs in the Worker or browser, and whether it declares install scripts (`preinstall`, `install`, `postinstall`): after installing, `bun pm untrusted` shows blocked ones, and a package on the default-trusted list runs its scripts without asking.
- **Lifecycle scripts run only for trusted packages.** Bun runs a dependency's lifecycle scripts only if it is on Bun's built-in default-trusted list (`bun pm default-trusted`; it includes `esbuild`, `workerd` and `sharp`) or listed in `trustedDependencies` in the root `package.json` (`bun add --trust <package>` adds it). `bun pm untrusted` lists installed packages whose scripts were blocked. Add a package to `trustedDependencies` only when it does not work without its script, and say why in the PR.
- **Be wary of fresh releases.** A version published in the last few days has had little scrutiny, and compromised releases are usually caught within that window. In a routine pass, prefer a version that has been out for some days; take a fresh one when it is the security fix.
- **The lockfile is reviewed.** `bun.lock` changes belong in the diff; an unexplained new package or changed source in it is a finding.

## Adding a dependency

`bun add <package>` in the workspace that uses it (or `bun add -d` for a dev dependency), never a range. The PR says, for each new package:

- what it is for, and why the platform or existing dependencies do not cover it;
- the checks under [Supply chain](#supply-chain): maintenance, downloads, install scripts, transitive count;
- where it runs (Worker, browser, build only) and, for runtime packages, the bundle size it adds;
- that it runs in workerd, for anything used by the Worker (Node built-ins are only partly available there).


Security milestone dependencies: `@better-auth/passkey@1.7.14` matches the existing auth release and supplies WebAuthn ceremonies through SimpleWebAuthn 13; it runs in the Worker and browser. `uqr@0.1.2` renders enrollment QR data locally in the browser (no external QR service). The already-transitive `@better-auth/utils@0.5.1` is explicit test tooling for real TOTP generation. None adds lifecycle scripts or trustedDependencies. The lockfile records their transitive dependencies. Runtime compatibility is verified by API/browser tests and the Worker build; no paid provider or external account is required. Exact installed package sources/types were used for API behavior. Registry metadata was independently checked on 31 October 2026: passkey 1.7.14 was published 26 October (matching the already-pinned auth core), uqr 0.1.2 on 16 August 2023, and fflate 0.8.3 on 16 May 2026. Passkey and uqr list two npm maintainers each; fflate lists one. None declares an install lifecycle hook. Passkey introduces 23 transitive lock entries; uqr and fflate have no runtime dependencies. The explicit auth-utils test dependency was already transitive. Public npm statistics for 23–29 October report approximately 2.76 million weekly passkey downloads, 9.08 million uqr, 25.26 million auth-utils and 141.62 million fflate. These counts are adoption evidence, not a security guarantee. [Passkey metadata](https://registry.npmjs.org/@better-auth%2fpasskey), [uqr metadata](https://registry.npmjs.org/uqr), [fflate metadata](https://registry.npmjs.org/fflate); npm download statistics use the public `/downloads/point/last-week/<package>` API. The isolated security production package measured 6,433 KiB uncompressed / 1,457 KiB gzip; final combined packaging is recorded separately because privacy and other features change it.


## Open baseline audit findings — 2026-10-31

The security milestone added pinned `@better-auth/passkey`, `uqr` and the explicit test dependency `@better-auth/utils`; privacy adds `fflate`. The audit also reported **13 existing package names** whose installed lockfile entries were not changed by those additions. This is an open tooling-maintenance record, **not an accepted advisory or a clean audit**.

`bun why` locates the affected versions in the build, test and typechecking graph:

| Packages                                                  | Existing dependency path / affected operation              | Application reachability assessment                                                                                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@babel/core`, `baseline-browser-mapping`, `browserslist` | Storybook/React doc generation and browser-target tooling  | Transforms repository source/configuration during development/build; no request-controlled transformation service is exposed by the app.                                           |
| `brace-expansion`, `glob`, `minimatch`                    | Build/test filesystem globbing                             | Operates on repository paths/patterns, not application upload contents.                                                                                                            |
| `esbuild`                                                 | Bundler and drizzle-kit tooling                            | The starter uses transformations/builds, not esbuild's standalone HTTP serving API. The older drizzle-kit copy remains installed.                                                  |
| `fast-uri`                                                | `@astrojs/check` → language server → Ajv                   | Typechecking schemas; not the Worker's MCP validator. No application URL allowlist or outbound request is based on this parser.                                                    |
| `nanoid`, `postcss`, `source-map-js`                      | Older Vite peer installation → CSS/source-map tooling      | Parses repository styles and generates build identifiers; no application endpoint accepts CSS/source maps or a caller-selected identifier size.                                    |
| `undici`                                                  | Older `@cloudflare/vite-plugin` → Miniflare/Wrangler       | Node development/test HTTP client. Worker requests use the platform's native fetch.                                                                                                |
| `vite`                                                    | Existing Vite 7 peer installation alongside Astro's Vite 8 | Development server/build tooling; never the deployed Worker HTTP server. Some advisories are Windows-only, but platform limitations do not clear the whole package's advisory set. |

The first integrated production build's 66 server source maps included none of these package paths, and executable output included no E2E Turnstile simulation. The browser build has no source maps; its assessment above follows dependency paths, rather than claiming a complete source-map proof. No reachable application-runtime exploit was established in this pass; developer/CI exposure remains and deserves a separate dependency update with this document's full verification process. Do not suppress these advisories or mark them accepted without the owner's decision.

Examples checked against primary advisories: [fast-uri IPv6 normalization](https://github.com/advisories/GHSA-f65p-4m7j-42xc), [nanoid non-secure negative-size loop](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [undici response decoding](https://github.com/advisories/GHSA-xjj6-f33q-929c), and [Vite/launch-editor Windows path handling](https://github.com/advisories/GHSA-587h-7wmj-h5pm). These illustrate the reachability conditions; they are not an exhaustive replacement for `bun audit --json`.

### ZIP export dependency

`fflate` 0.8.3 is pinned for the approved Zip port adapter. It provides a small maintained streaming ZIP implementation under MIT with no runtime dependencies or install scripts; the owning adapter is `platform/adapters/fflate`, with a wire-format/backpressure contract test and a recording memory wrapper. Node zlib/CompressionStream alone do not write ZIP directories; a handwritten archive implementation would add security/compatibility surface. The fflate package source and streaming API were checked at https://github.com/101arrowz/fflate and installed with `bun add`. Combined dependency audit remains part of final validation.
