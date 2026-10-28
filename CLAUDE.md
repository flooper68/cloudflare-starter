# Cloudflare Starter: rules for agents and reviewers

A Bun monorepo: one Astro web Worker (`apps/web`) with Better Auth, D1, R2, email, tRPC, MCP, queue consumer and cron; shared code in `packages/features` and `packages/ui`. Start with [README.md](README.md).

## Before you finish a change

- `bun run verify` passes (typecheck, Biome, Vitest). `bun run build` passes when you touched app code or config.
- Schema changed: `bun run db:generate` produced a migration, committed with `migrations/meta/`.
- Docs under `docs/` and the README still describe what the code does.

## Rules

1. **Every API is reachable through MCP.** A new tRPC procedure gets an MCP tool in `apps/web/src/server/mcp/tools.ts`; a new non-tRPC endpoint under `apps/web/src/pages` is listed in `NON_TRPC_ROUTES`. Exemptions need a reason a reviewer would accept. `parity.test.ts` enforces this; do not weaken the test to get green. See `docs/how-to-setup-mcp.md`.
2. **Logic lives in procedures, not in tools or components.** MCP tools are thin adapters that call procedures in-process; React components call tRPC.
3. **Bindings over keys.** Use Worker bindings (D1, R2, send_email, queues) where they exist; keep secrets in `.dev.vars` and Worker secrets, never in code, config or command arguments.
4. **Config is `wrangler.jsonc`, per environment.** Bindings are not inherited by `env.*`; add a binding to every environment. The environment is chosen at build time (`CLOUDFLARE_ENV`, the `deploy:*` scripts).
5. **Migrations are additive first.** No `drizzle-kit push` against remote databases. `packages/features/src/db/schema/auth.ts` is generated; see `docs/how-to-setup-auth.md`.
6. **Dependencies are pinned exactly** (`bunfig.toml`). Add with `bun add`, which pins.

## Skills

`.claude/skills/setup-auth`, `setup-d1`, `setup-email` cover setting those up with the `bun run setup:*` scripts. Anything that creates resources, sets secrets or deploys changes the owner's Cloudflare account: preview with `--dry-run` and confirm first.
