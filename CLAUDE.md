# Cloudflare Starter: agent entry point

A Bun monorepo for Cloudflare-first products: one Astro web Worker (`apps/web`) with Better Auth, D1, R2, email, tRPC, MCP, a queue consumer and cron; server features in `packages/features`, components in `packages/ui`. This file holds the rules that always apply and routes you to the rest. `AGENTS.md` is a symlink to it.

## Always

1. **Verify before you finish, with evidence.** Run the narrowest real check, then `bun run verify` (and `bun run build` when app code or config changed). Report commands and results; never hide or skip a failure. User-visible changes also need screenshots or a walkthrough attached to the PR ([development.md](docs/processes/development.md#4-evidence)).
2. **Every API is reachable through MCP.** A new tRPC procedure gets a tool in `apps/web/src/server/mcp/tools.ts`; a new endpoint under `apps/web/src/pages` gets a `NON_TRPC_ROUTES` entry with a reason. Do not weaken `parity.test.ts`.
3. **Follow the architecture principles** in [docs/architecture/overview.md](docs/architecture/overview.md#principles): features in `packages/features`, pure domain, thin adapters, barrels, no cycles. Do not copy code listed under "Current state vs target".
4. **Docs and context ship with the change.** Every setup step, env var, secret, binding, resource, script or CI change is documented in the same PR ([code-review.md checklist 5](docs/processes/code-review.md#5-documentation-and-retrievable-context)).
5. **On an unexpected error, grep the docs and skills for the exact error text first.** If the plan did not settle the problem, stop and ask with a recommendation.
6. **Ask before touching the owner's Cloudflare account, secrets, GitHub settings or deploys.** Dry-run first (`--dry-run` on `setup:*` scripts). Commit, push and deploy only on an explicit yes.
7. **Leave the machine clean.** Stop dev servers, watchers and tunnels you started; scratch files, screenshots and logs stay out of the repo.
8. **Pin dependencies exactly.** Add with `bun add` (`bunfig.toml` sets `exact = true`); no `^` or `~`.
9. **Never credit an AI agent.** No Claude, Codex or other agent as author or co-author: no `Co-Authored-By` trailers, no "Generated with …" lines, in commits, PR descriptions or code. The person who asked for the work is the author. CI checks commits (`scripts/check-attribution.ts`).

## Read when

| Read                                                           | When                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [docs/README.md](docs/README.md)                               | you need any guide; it indexes all docs with "use when" lines                             |
| [docs/architecture/overview.md](docs/architecture/overview.md) | you plan or review a change, or add a feature, table, procedure, route, binding, env var  |
| [docs/architecture/testing.md](docs/architecture/testing.md)   | you decide which tests a change needs                                                     |
| [docs/processes/development.md](docs/processes/development.md) | you start any non-trivial change or write a plan                                          |
| [docs/processes/code-review.md](docs/processes/code-review.md) | you review a diff (yours or someone else's); reviewer agent: `.claude/agents/reviewer.md` |
| [docs/processes/adrs.md](docs/processes/adrs.md)               | a change makes or reverses a decision others will build on                                |
| `.claude/skills/setup-auth`, `setup-d1`, `setup-email`         | you set up or change auth, the database, or email                                         |
| [packages/ui/CONVENTIONS.md](packages/ui/CONVENTIONS.md)       | you write or review UI components or stories                                              |
