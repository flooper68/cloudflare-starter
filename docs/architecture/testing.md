# Testing Strategy

The only source of test requirements in this repository: which layers of tests exist, which tests a change must add, how fast each layer must stay, and which pieces of test infrastructure do not exist yet. Plans and issues may size the tests, but never waive a required one. Use when you plan a change, write its tests, or review whether the tests in a PR are enough.

## Layers

| Layer       | What it proves                                                                                                                     | Tooling                                                                                                                                                                                                           | Location                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Domain      | Pure rules, schemas and domain errors give the right output for each input                                                         | Vitest, `node` environment; no mocks needed because domain code has no I/O                                                                                                                                        | `packages/features/src/<feature>/domain/*.test.ts`      |
| Integration | Use cases work against real D1, R2 and queues                                                                                      | Vitest in workerd via `@cloudflare/vitest-plugin` (project `features-integration`, `packages/features/vitest.config.ts`); bindings from `packages/features/test/wrangler.jsonc`; migrations applied per test file | `packages/features/src/<feature>/*.integration.test.ts` |
| API         | tRPC procedures as a signed-in user, HTTP routes including auth, origin checks and status codes, and the same calls through `/mcp` | Vitest in workerd (project `web-api`, `apps/web/vitest.config.ts`) with the app's real bindings from `wrangler.jsonc`; users signed up through Better Auth's handler (`test/api/helpers.ts`)                      | `apps/web/test/api/`                                    |
| Component   | Every story renders and passes axe; `play` functions drive interactions                                                            | Storybook stories as tests via `@storybook/addon-vitest` (browser mode)                                                                                                                                           | `packages/ui/src/components/*.stories.tsx`              |
| E2E         | A handful of critical journeys work end to end: sign up, sign in, the main CRUD flow, upload, MCP consent                          | Playwright against `astro dev` with local bindings                                                                                                                                                                | `apps/web/test/e2e/`                                    |
| Static      | Types, lint, import rules, MCP parity, migrations in sync with the schema                                                          | `tsc`/`astro check`, Biome (with GritQL plugins), dependency-cruiser, `parity.test.ts`, the CI `migrations` job, `test/architecture/`                                                                             | CI jobs `lint`, `typecheck`, `test`, `migrations`       |

Pure helpers inside `apps/web` (config parsing, log builders) are unit tests next to the file (`*.test.ts`), like domain tests.

**Real databases, no mocks.** Integration and API tests run inside workerd, Cloudflare's Workers runtime, locally and in CI, through Miniflare. D1 is real SQLite with the real migrations applied, R2, queues and `send_email` are Miniflare's local implementations, and nothing reaches a Cloudflare account. Each test file starts from its own empty, migrated database (storage is isolated per file, not per test), so tests create their own users and data and do not depend on each other. Production settings stay on: for example sign-up is rate limited, so an API test file signs up one user and shares it.

Commands: `bun run test` (all projects), `bun run test:unit` (Node: domain, helpers, architecture), `bun run test:integration` (both workerd projects).

## Change → required test

| Change                             | Required test                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| New tRPC procedure                 | API test calling it as a signed-in user (and anonymous, if protected) + an MCP tool covered by the API test through `/mcp` |
| New domain rule or schema          | Domain test covering accepted and rejected inputs                                                                          |
| New query, table or column         | Integration test of the use case that reads or writes it                                                                   |
| New use case                       | Domain test for its rules; integration test if it touches a binding                                                        |
| New UI component                   | Stories per [CONVENTIONS.md](../../packages/ui/CONVENTIONS.md); a `play` test for each interaction                         |
| New HTTP route                     | API test: unauthenticated, wrong origin, invalid input, success                                                            |
| New binding                        | Integration test that uses it through the local binding                                                                    |
| New queue message type or cron job | Integration test of the use case it calls; unit test of message parsing                                                    |
| Bug fix                            | A test at the lowest layer that reproduces it and fails without the fix                                                    |
| New critical journey               | E2E test, only if it is one of the journeys listed above or the owner adds it to that list                                 |

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

What does not exist yet. Until an enabler lands, a required test at that layer is written at the nearest existing layer and the gap is named in the PR.

| Gap             | Today                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Component tests | `@storybook/addon-vitest` is not set up; stories are not run as tests (every component has stories: `test/architecture/stories.test.ts`). |
| E2E             | No Playwright setup.                                                                                                                      |

What exists: unit tests (domain, helpers), integration tests on real D1/R2, API tests (tRPC, file routes, auth, `/mcp`), the MCP parity and in-process server tests, and the architecture tests in `test/architecture/`, which also require a test per domain function, use case and tRPC procedure (`test-presence.test.ts`).

## Enablers

Infrastructure to build, each by the first change that needs it (that change carries the enabler, its docs and the script that runs it):

| Enabler                                                 | Built by the first change that adds |
| ------------------------------------------------------- | ----------------------------------- |
| `@storybook/addon-vitest` browser-mode project with axe | a component `play` test             |
| Playwright config against `astro dev`, seeded local D1  | an E2E journey                      |

Each enabler adds its command to `package.json`, to CI, and to the "Layers" table above.
