# Code Review

How a change is reviewed before it ships: who reviews it, which findings count, how severe they are, and the six checklists every review runs. Applies to self-review, the independent reviewer subagent ([.claude/agents/reviewer.md](../../.claude/agents/reviewer.md)) and human review. Use when you review a diff, respond to a review, or decide whether a change needs an independent reviewer.

## Risk tiers

| Tier  | Applies to                                                                                                                                                                                    | Review                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Small | Local change in one feature or component, no auth, data, binding, migration, CI or deploy impact                                                                                              | Self-review in context, all six checklists                                                                                                                         |
| Risky | Auth or authorization, migrations, new bindings or resources, MCP tools, HTTP routes, CI/deploy, `docs/processes/` or `AGENTS.md`, cross-feature changes, anything the author is unsure about | Independent reviewer subagent, given only the written task contract (plan or issue with the owner's answers) and the diff, not the conversation. Then self-review. |

After an independent review, the author tries to refute each finding (reads the code, runs the input) before reporting it. Findings that survive are fixed or reported; refuted ones are reported with the refutation.

## Admission rules

A finding counts only if all hold:

1. **Caused by the diff.** Pre-existing problems go into a separate note, not this review.
2. **Breaks something stated:** a requirement in the task contract, an API or data contract, a principle in [architecture/overview.md](../architecture/overview.md), a rule in [testing.md](../architecture/testing.md), or a checklist item below.
3. **Concrete, with evidence:** `file:line`, and an input that leads to a wrong output, a failing command, or the exact rule broken.
4. **Has a proportional fix:** smaller than the problem.

Out: style preferences, "another design would also work", speculative future needs, and anything an automated rule already checks when CI is green.

## Severities

| Severity | Meaning                                                                                                                                          | Handling                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Critical | Security hole, data loss, broken deploy, production outage                                                                                       | Must fix, then re-verify                            |
| High     | Wrong behaviour for users or agents, missing required test, broken contract, missing evidence for a user-visible change, undocumented setup step | Must fix, then re-verify                            |
| Medium   | Real defect with limited reach (edge case, degraded error message)                                                                               | Fix, or the owner accepts it with a one-line reason |
| Low      | Minor, no user impact                                                                                                                            | Fix, or the owner accepts it with a one-line reason |

Only the owner accepts a Medium or Low finding; the author does not. A fix that would change the agreed scope is not made: it goes back to the owner as a **scope conflict**, with options and a recommendation.

## Automated rules: do not re-check by hand

If CI is green, these hold; reviewers do not check them manually:

- Import cycles (Biome `noImportCycles`)
- `drizzle-orm` in `apps/web` (Biome `noRestrictedImports`)
- `export *` outside the package roots (Biome `noReExportAll`)
- Domain purity, tokens-only UI classes, no DB calls in adapters (GritQL rules in `lint/rules/*.grit`)
- Layer direction, pure domain and kernel imports, barrel-only imports between folders, ui↔features isolation (dependency-cruiser, `bun run deps:check`)
- One exported runtime function per use-case file, a test per domain function and use case, an API test per tRPC procedure, every UI component has stories, exact pins, bindings in all environments, `-- contract:` reason on `DROP`/`RENAME` migrations (`test/architecture/`)
- MCP parity (`parity.test.ts`), types, formatting, migrations in sync and applying to an empty D1
- No AI agent credited in a PR's commits (`scripts/check-attribution.ts` in the CI `lint` job)

Automation proves a test exists, not that it is good: reviewers still check that each required test would fail without the change (checklist 4).

## Checklists

### 1. Server-side architecture

- [ ] Business logic lives in `domain/` or a use case, not in tRPC procedures, MCP tools, HTTP routes, queue or cron handlers.
- [ ] `domain/` is pure: time, ids and I/O come in as arguments.
- [ ] One concept per file; barrels list exports explicitly; outside code imports only barrels.
- [ ] Dependencies point apps → features → domain; `packages/ui` and `packages/features` stay apart.
- [ ] Failures are typed domain errors, mapped to transport errors in the adapter.
- [ ] Use cases take explicit deps (`db`, `bucket`, `clock`, `ids`), no globals or `cloudflare:workers` imports.
- [ ] Every new procedure has an MCP tool with a model-facing description, or an exemption with a reason.

### 2. Security and auth

- [ ] Every procedure is `protectedProcedure` unless deliberately public, and checks ownership of the records it touches.
- [ ] Every HTTP route checks the session; state-changing routes check `Origin` (Astro `checkOrigin` is off); tRPC POSTs require `x-trpc-source`.
- [ ] Secrets never appear in code, config, command arguments, logs, errors or tool results.
- [ ] Untrusted input (request bodies, query strings, queue messages, tool arguments) is validated with zod at the boundary.
- [ ] User data in MCP results is inside `<untrusted-data>`; tools that send something outside the app are `outward: true` and say "confirm with the user".
- [ ] A new dependency has the justification [dependencies.md](dependencies.md#adding-a-dependency) asks for; updated ones have their changelogs read, derived files regenerated and `bun audit` findings triaged; every `overrides` entry and accepted advisory has a row in [Overrides and accepted advisories](dependencies.md#overrides-and-accepted-advisories); every `trustedDependencies` addition has a reason.

### 3. Cloudflare, D1 and bindings

- [ ] A new binding, var or trigger is in the top level, `env.staging` and `env.production` of `wrangler.jsonc`.
- [ ] Migrations are additive; `DROP`/`RENAME` only with a `-- contract:` reason after no deployed code uses the column.
- [ ] Generated migration and `migrations/meta/` are committed; no `drizzle-kit push` to remote.
- [ ] The environment is chosen at build time (`CLOUDFLARE_ENV`); no code assumes `wrangler deploy --env` retargets.
- [ ] No resource ids, account ids or URLs hard-coded outside `wrangler.jsonc` and secrets.
- [ ] New or changed queries filter and sort on indexed columns, select only needed columns and run no query per item in a loop; heavy or slow work goes to a queue; no project budget in [performance.md](../architecture/performance.md) is broken or changed without a reason.

### 4. Tests

- [ ] Every test [testing.md](../architecture/testing.md) requires for this change exists.
- [ ] Each would fail without the change (for bug fixes: verified by running it against the old code).
- [ ] Tests stay within the layer's speed budget and use the fixture guidance.

### 5. Documentation and retrievable context

A new person or agent must be able to set up, run and deploy from the repository alone, without this conversation.

- [ ] Every setup step, env var, secret, binding, Cloudflare resource, script, deployment or CI change is documented where the [docs index](../README.md) leads.
- [ ] `apps/web/.dev.vars.example`, `wrangler.jsonc` comments, `scripts/setup-*.ts`, `scripts/doctor.ts`, `.claude/skills/` and the guides are updated in the same PR.
- [ ] Renamed or removed names no longer appear in docs (the author's docs-audit search covers them).
- [ ] Decisions that need an ADR have one ([adrs.md](adrs.md)); the architecture doc states the current rule.
- [ ] No knowledge lives only in chat or PR comments.
- [ ] Evidence (screenshots, walkthroughs, tool output) is attached and matches the claimed behaviour; missing evidence for a user-visible change is a High finding.

### 6. UI states and the component library

Rules in [packages/ui/CONVENTIONS.md](../../packages/ui/CONVENTIONS.md).

- [ ] Every view or widget that loads data handles **loading, error, empty and content**, preferably through `DataState`. A missing state is a High finding.
- [ ] Loading shows a `Skeleton*` shaped like the content; spinners only inside the control that started a short action.
- [ ] Errors use `ErrorState` (page, compact or inline) with a message safe to show and a way forward (retry or another destination); no blank areas, raw stack traces or swallowed errors. Failed mutations surface as a toast or inline error.
- [ ] Empty states use `EmptyState` with why it is empty and the next step (usually a primary action).
- [ ] The evidence shows each of these states, not only the happy path.
- [ ] Screens are built from library components and tokens; a missing component is added to `packages/ui` with stories rather than styled ad hoc in the app.

## Reporting

Each finding: severity, `file:line`, evidence (input → wrong output, or the rule broken), proposed fix. The PR lists every finding and how it was handled (fixed, refuted with reason, accepted by the owner with reason, scope conflict).

## Learning loop

After the owner reviews a PR, the author turns each general review point into a proposed checklist item or automated rule, in the PR or a follow-up. The owner approves which land. Changes to `docs/processes/` or `AGENTS.md` are called out in the PR description.
