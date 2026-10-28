# 0010. Feature-sliced server architecture with a pure domain and enforced import rules

- Status: Accepted
- Date: 2026-10-28

## Context

Server logic serves three adapters: tRPC for the web app, MCP tools for agents, and queue and cron handlers. When logic lives in an adapter, it is duplicated or reachable only one way, and tests need the whole adapter. Code grouped by technology (`db/`, `email/`, `storage/`) spreads one feature across folders. Agents copy whatever pattern they find nearby, so rules that exist only in prose erode. Code that reads the clock, generates ids or performs I/O directly is hard to test without mocks.

## Decision

Server code is organised by feature in `packages/features/src/<feature>/`: a barrel `index.ts` as the public API, a pure `domain/` (types, rules, zod schemas, typed errors), one use case per file taking its dependencies (db, bucket, clock, ids) as arguments, and `<feature>.schema.ts` for its tables. Shared infrastructure lives in `packages/features/src/platform/`. Apps are thin adapters that call use cases and contain no business logic or DB calls.

General rules: one concept per file; barrels with explicit exports; no import cycles; dependencies point apps → features → domain; `domain/` is pure; `packages/ui` and `packages/features` never import each other.

The rules are enforced in CI: Biome (`noImportCycles`, `noRestrictedImports`, `noReExportAll`), Biome GritQL plugins in `lint/rules/*.grit`, dependency-cruiser (`bun run deps:check`) and architecture tests in `test/architecture/`. The current rules and the remaining gap to this shape are in [architecture/overview.md](../architecture/overview.md#principles).

## Consequences

Positive:

- One place per behaviour, reached the same way by web, MCP, queue and cron.
- Domain rules are tested as plain functions; use cases are tested with real bindings and a fixed clock.
- A feature can be read, moved or deleted as one folder.
- Agents get failing checks instead of relying on prose rules.

Negative:

- More files and barrels than a flat layout; small features carry some ceremony.
- Passing deps explicitly adds parameters to every use case.
- The existing code must be restructured, and the enforcement tooling (GritQL plugins, dependency-cruiser) must be maintained.

## Alternatives considered

- **Layered by technology (`db/`, `email/`, `storage/`).** Features spread across folders; no place for rules that span them. Rejected.
- **Logic in tRPC procedures, MCP tools calling procedures.** Queue and cron handlers cannot reuse it, and procedures mix transport concerns with rules. Rejected.
- **Rules in docs only, checked in review.** Erodes as code is copied; review time spent on mechanical checks. Rejected.
