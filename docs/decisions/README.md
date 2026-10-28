# Decisions

Architecture Decision Records: why the starter is built the way it is, and which alternatives were rejected. The current rules are in [architecture/overview.md](../architecture/overview.md); how to write an ADR is in [processes/adrs.md](../processes/adrs.md). Use when you want to know why something is the way it is, or before proposing to change it.

| ADR                                                | Decision                                                                        | Status   |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)      | Record architecture decisions                                                   | Accepted |
| [0002](0002-d1-and-drizzle.md)                     | Cloudflare D1 with Drizzle as the database                                      | Accepted |
| [0003](0003-better-auth-in-the-worker.md)          | Better Auth in the Worker for authentication                                    | Accepted |
| [0004](0004-mcp-server-with-parity-test.md)        | MCP server by default, with a parity test                                       | Accepted |
| [0005](0005-one-worker-for-http-queue-and-cron.md) | One Worker for HTTP, queue consumer and cron                                    | Accepted |
| [0006](0006-wrangler-jsonc-env-at-build-time.md)   | wrangler.jsonc per environment, environment chosen at build time                | Accepted |
| [0007](0007-cloudflare-email-service.md)           | Cloudflare Email Service for outgoing mail                                      | Accepted |
| [0008](0008-r2-binding-and-presigned-urls.md)      | R2 through the binding and through presigned URLs                               | Accepted |
| [0009](0009-exact-dependency-pins.md)              | Exact dependency pins, updated when a project starts                            | Accepted |
| [0010](0010-feature-sliced-server-architecture.md) | Feature-sliced server architecture with a pure domain and enforced import rules | Accepted |
| [0011](0011-component-library-and-storybook.md)    | Component library in Linear's visual language, Storybook served by the web app  | Accepted |

New ADR: copy [0000-template.md](0000-template.md) to the next free number and add a row here.
