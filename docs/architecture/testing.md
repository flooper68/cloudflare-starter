# Testing Strategy

The only source of test requirements in this repository: which layers of tests exist, which tests a change must add, how fast each layer must stay, and which pieces of test infrastructure do not exist yet. Plans and issues may size the tests, but never waive a required one. Use when you plan a change, write its tests, or review whether the tests in a PR are enough.

## Layers

| Layer       | What it proves                                                                                                                                                  | Tooling                                                                                                                                                                                                           | Location                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Domain      | Pure rules, schemas and domain errors give the right output for each input                                                                                      | Vitest, `node` environment; no mocks needed because domain code has no I/O                                                                                                                                        | `packages/features/src/<feature>/domain/*.test.ts`      |
| Integration | Use cases work against real D1, R2 and queues                                                                                                                   | Vitest in workerd via `@cloudflare/vitest-plugin` (project `features-integration`, `packages/features/vitest.config.ts`); bindings from `packages/features/test/wrangler.jsonc`; migrations applied per test file | `packages/features/src/<feature>/*.integration.test.ts` |
| API         | tRPC procedures as a signed-in user, HTTP routes including auth, origin checks and status codes, and the same calls through `/mcp`                              | Vitest in workerd (project `web-api`, `apps/web/vitest.config.ts`) with the app's real bindings from `wrangler.jsonc`; users signed up through Better Auth's handler (`test/api/helpers.ts`)                      | `apps/web/test/api/`                                    |
| Component   | Every story renders in Chromium and passes axe (any violation fails) in the dark and the light theme; `play` functions drive interactions with `storybook/test` | Storybook stories as Vitest tests via `@storybook/addon-vitest` in browser mode (Playwright Chromium), `apps/storybook/vitest.config.ts`; axe from `@storybook/addon-a11y` with `a11y.test: "error"`              | `packages/ui/src/components/**/*.stories.tsx`           |
| E2E         | The critical journeys work end to end in a browser: sign up, profile and password change, sign out and sign in, upload through the `FILES` binding              | Playwright (`apps/web/playwright.config.ts`) against `astro dev` with local bindings and a migrated local D1; Playwright starts and stops the dev server                                                          | `apps/web/test/e2e/`                                    |
| Static      | Types, lint, import rules, MCP parity, migrations in sync with the schema                                                                                       | `tsc`/`astro check`, Biome (with GritQL plugins), dependency-cruiser, `parity.test.ts`, the CI `migrations` job, `test/architecture/`                                                                             | CI jobs `lint`, `typecheck`, `test`, `migrations`       |

Pure helpers inside `apps/web` (config parsing, log builders) are unit tests next to the file (`*.test.ts`), like domain tests.

**Real databases, no mocks.** Integration and API tests run inside workerd, Cloudflare's Workers runtime, locally and in CI, through Miniflare. D1 is real SQLite with the real migrations applied, R2, queues and `send_email` are Miniflare's local implementations, and nothing reaches a Cloudflare account. Each test file starts from its own empty, migrated database (storage is isolated per file, not per test), so tests create their own users and data and do not depend on each other. Production settings stay on: for example sign-up is rate limited, so an API test file signs up one user and shares it.

**Tests do not read your local settings.** Wrangler loads `apps/web/.dev.vars` into the API test Worker too; every var and secret the app reads is pinned in `apps/web/test/api-bindings.ts` (the develop values of `wrangler.jsonc`), which overrides it, so a local `APP_ENV=local`, `LOG_SINK=none` or Google keys cannot change results. `test/architecture/api-test-bindings.test.ts` fails when a key of `.dev.vars.example` or of the top-level `vars` is not pinned there: add new vars and secrets to it.

Commands: `bun run test` (all Vitest projects in Node and workerd), `bun run test:unit` (Node: domain, helpers, architecture), `bun run test:integration` (both workerd projects), `bun run test:components` (stories in Chromium), `bun run test:e2e` (Playwright journeys). `bun run verify` runs lint, typecheck and `test`; run `test:components` after UI changes and `test:e2e` after changes to auth, pages or routes. CI runs all of them.

### Component tests

- Every story is a test, run once per theme (Vitest projects `storybook-dark` and `storybook-light`): it must render without errors and pass axe, colour contrast included. Accessibility is a gate, not a report: `a11y: { test: "error" }` in `apps/storybook/.storybook/preview.tsx`. Fix a violation in the component or the story; never turn a rule off globally.
- A rule may be turned off for one story only when a third-party library renders the offending markup and offers no way to fix it, with a comment naming the library and the reason (`parameters.a11y.config.rules`). Today: `aria-hidden-focus` on the stories that render an open Radix Select or DropdownMenu (Radix hides the page with `aria-hidden` but leaves the trigger focusable).
- Interaction tests are `play` functions in stories named for what they prove (`SearchAndPick`, `KeyboardNavigation`), using `userEvent`, `expect`, `within` and `waitFor` from `storybook/test`. Popovers and dialogs are portalled: query them with `within(canvasElement.ownerDocument.body)`. Async results: `findBy*` with a timeout above the story's latency.
- Run one file: `cd apps/storybook && bunx vitest run --config vitest.config.ts ../../packages/ui/src/components/combobox.stories.tsx`. In Storybook (`bun run storybook`) the Interactions and Accessibility panels show the same results.

### E2E tests

- Prerequisites: `apps/web/.dev.vars` (copy `.dev.vars.example`) and a migrated local D1 (`bun run db:migrate:local`), the same as `bun run dev:web`. Chromium once: `cd apps/web && bunx playwright install chromium` (in apps/web, where the pinned Playwright is installed).
- Playwright starts `astro dev --ignore-lock` (the flag keeps Astro in the foreground when an AI agent runs it) and stops it after the run; locally it reuses a dev server already running on port 4321.
- Sign-up is rate limited (5 per minute per IP). The suite signs up two users per run: `auth.setup.ts` creates the shared user whose session other journeys reuse (`test.use({ storageState: sharedSession })`), and `auth.spec.ts` walks one new account through its life in serial steps. Every run uses new, unique emails, so the persistent local D1 needs no reset. Two runs a minute fit; a third gets "Too many requests".
- Failures keep a trace, video and screenshot in `apps/web/test-results/` and an HTML report in `apps/web/playwright-report/` (`bunx playwright show-report` in `apps/web`); CI uploads both as the `playwright-report` artifact.

## Change → required test

| Change                               | Required test                                                                                                                                                                                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New tRPC procedure                   | API test calling it as a signed-in user (and anonymous, if protected) + an MCP tool covered by the API test through `/mcp`                                                                                                                                                              |
| New domain rule or schema            | Domain test covering accepted and rejected inputs                                                                                                                                                                                                                                       |
| New query, table or column           | Integration test of the use case that reads or writes it                                                                                                                                                                                                                                |
| New use case                         | Domain test for its rules; integration test if it touches a binding                                                                                                                                                                                                                     |
| New UI component                     | Stories per [CONVENTIONS.md](../../packages/ui/CONVENTIONS.md), all passing axe; a `play` test for each interaction                                                                                                                                                                     |
| New HTTP route                       | API test: unauthenticated, wrong origin, invalid input, success                                                                                                                                                                                                                         |
| New binding                          | Integration test that uses it through the local binding                                                                                                                                                                                                                                 |
| New queue message type or cron job   | Integration test of the use case it calls; unit test of message parsing                                                                                                                                                                                                                 |
| New port or adapter                  | Contract suite: a new port gets `ports/<port>.contract.ts` (`describe<Port>Contract`); each adapter a `<name>.contract.test.ts` calling it (`.contract.integration.test.ts` when it needs workerd). Code that uses a port is tested with the `memory` adapter, not console or SDK spies |
| New audit action or audited use case | Domain test: the action's example in `audit-event.test.ts` (accepted; undeclared metadata and wrong target rejected); integration test of the use case asserting the event it records                                                                                                   |
| Bug fix                              | A test at the lowest layer that reproduces it and fails without the fix                                                                                                                                                                                                                 |
| Change to a UI interaction           | A `play` test in the component's stories that fails without the change                                                                                                                                                                                                                  |
| New critical journey                 | E2E test, only if it is one of the journeys listed above or the owner adds it to that list                                                                                                                                                                                              |

A required test must fail when the change is reverted. A test that passes either way does not count.

## Fixtures and test data

- Build data with small factory functions per feature (`makeFile({ ...overrides })`) next to the tests that use them; no shared global fixture files.
- Pass a fixed clock and deterministic ids into use cases instead of mocking `Date` or `crypto`.
- Integration and API tests start from an empty migrated database and create what they need; never depend on another test's rows or on order.
- Signed-in calls use a test helper that creates a user and a session through Better Auth, not hand-written session rows.
- Realistic values (names, filenames, sizes), no lorem ipsum; never real personal data or real secrets.

## What not to test

- Framework internals: Astro routing, tRPC's input parsing, Drizzle's SQL generation, Better Auth's own flows beyond our configuration.
- Styling: class names, colours, pixel layout. Visual review happens in Storybook and PR evidence.
- Private helpers on their own when the public function's tests cover them.
- Mock-heavy tests that only restate the implementation (asserting that a mocked `db.insert` was called).

## Speed budget

| Layer       | Budget                                      |
| ----------- | ------------------------------------------- |
| Domain      | under 10 ms per test; whole layer under 5 s |
| Integration | under 2 s per file; whole layer under 60 s  |
| API         | under 2 s per file; whole layer under 90 s  |
| Component   | whole layer under 3 min                     |
| E2E         | whole suite under 5 min                     |
| Static      | each CI job under 5 min                     |

A test that breaks its budget is fixed (smaller data, narrower scope, lower layer) before more tests are added to that layer.

## Known gaps

None: every layer above has its tooling, command and CI job. When a layer is missing again, list it here with what exists today; until its enabler lands, a required test at that layer is written at the nearest existing layer and the gap is named in the PR.

What exists: unit tests (domain, helpers), integration tests on real D1/R2, API tests (tRPC, file routes, auth, `/mcp`), component tests (every story with axe, `play` interaction tests), E2E journeys in Playwright, the MCP parity and in-process server tests, and the architecture tests in `test/architecture/`, which also require a test per domain function, use case and tRPC procedure, and a contract test per platform adapter (`test-presence.test.ts`).

## Performance checks

Performance checks (D1 query budgets, bundle budgets, Web Vitals, load tests) are not a layer of their own: each fits next to a layer above or runs against a deployment. The starter ships none; which a project adopts, and how, is in [performance.md](performance.md).
