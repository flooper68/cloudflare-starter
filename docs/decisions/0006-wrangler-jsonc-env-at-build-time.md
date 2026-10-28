# 0006. wrangler.jsonc per environment, environment chosen at build time

- Status: Accepted
- Date: 2026-10-28

## Context

The web Worker deploys to `develop`, `staging` and `production`, each with its own D1 database, R2 bucket, queues and vars. Cloudflare recommends `wrangler.jsonc` for new projects, and some newer Wrangler features are configurable only in JSON. Wrangler does not inherit bindings from the top level into `env.*`. The Astro Cloudflare adapter writes a flattened Wrangler config for one environment into the build output, so `wrangler deploy --env <name>` cannot retarget a bundle that was built for another environment.

## Decision

Config is `wrangler.jsonc`. `develop` is the top level; `env.staging` and `env.production` each declare every binding, var and trigger. The environment is chosen at build time with `CLOUDFLARE_ENV=<env>`; the `deploy`, `deploy:staging` and `deploy:production` scripts in `apps/web/package.json` build and deploy together. Setup scripts (`setup:cloudflare`, `setup:email`) edit the file with a JSONC parser so comments survive.

## Consequences

Positive:

- JSON schema validation and access to JSON-only features; comments explain each block.
- A deploy cannot silently use another environment's resources.

Negative:

- Every binding is repeated three times; forgetting one breaks only that environment. An architecture test checks this.
- `wrangler deploy --env` looks right but does nothing useful here; docs and scripts must keep saying so.
- Switching environment means rebuilding.

## Alternatives considered

- **`wrangler.toml`.** Not the format Cloudflare recommends, and some features are JSON-only. Rejected.
- **Build once, deploy with `--env`.** Does not work with the Astro adapter's flattened config. Rejected.
