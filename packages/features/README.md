# @cloudflare-starter/features

Shared feature code consumed by every app and worker in this monorepo — database access, email sending, queue message schemas, R2 storage helpers.

## Layout

```
src/
├── index.ts       Root barrel. Every public symbol is re-exported here.
├── db/            Drizzle schema (Better Auth + app tables) + D1 client factory.
├── email/         Email service over the Cloudflare send_email binding.
├── queue/         Zod schemas + producer/consumer helpers for the app queue.
└── storage/       R2 presign, file record creation, ownership lookup.
```

## Usage

Consumers always import from the package root — there are no subpath exports.

```ts
import {
  createDb,
  enqueueAppMessage,
  presignUpload,
  uploadInputSchema,
} from "@cloudflare-starter/features";
```

## Adding a feature

1. Create `src/<feature-name>/index.ts` (kebab-case folder).
2. Add explicit re-exports to `src/index.ts` — no wildcards.
3. Keep dependencies at the package level in `package.json`.

## No UI code

This package runs in both Node and Cloudflare Workers. React components and hooks belong in `apps/web`. Anything that imports `react` should not live here.

## Database

- Schema: `src/db/schema/` (`auth.ts` holds the Better Auth tables)
- Migrations: `migrations/` (generated SQL, applied by Wrangler from `apps/web`)

From the repo root:

```
bun run db:generate        # write a migration from schema changes
bun run db:migrate:local   # apply pending migrations to local D1
```

The Drizzle config is at `drizzle.config.ts`. See [docs/how-to-setup-d1.md](../../docs/how-to-setup-d1.md).
