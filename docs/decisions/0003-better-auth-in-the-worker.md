# 0003. Better Auth in the Worker for authentication

- Status: Accepted
- Date: 2026-10-28

## Context

The app needs sign-in (email and password, optionally Google), sessions for the web app, and an OAuth 2.1 authorization server so MCP clients such as Claude can act as the user ([0004](0004-mcp-server-with-parity-test.md)). Users should live in our own database next to the data that references them, and a new project should not need a paid vendor account to start.

## Decision

We run Better Auth inside the web Worker, handler at `/api/auth/*`, configured in `apps/web/src/server/auth.ts`. Users, sessions, accounts and rate-limit counters are stored in D1 through the Drizzle adapter. Sign-in methods are switched by env: `AUTH_EMAIL_PASSWORD`, `AUTH_REQUIRE_EMAIL_VERIFICATION`, and Google when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. The `jwt()` and `mcp()` plugins make it the OAuth server for `/mcp`, issuing tokens bound to that resource. The auth tables are generated from Better Auth's schema.

## Consequences

Positive:

- No external auth vendor or per-user cost; user rows are joinable with app data.
- One system for web sessions and MCP OAuth; the consent page is ours.
- Runs locally with no setup beyond `BETTER_AUTH_SECRET`.

Negative:

- We own security-relevant configuration: rate limits, origins, secret rotation, upgrades.
- Auth tables must be regenerated and migrated after Better Auth upgrades or new plugins.
- Features a hosted provider ships (admin UI, fraud detection, SSO catalogue) are not included.

## Alternatives considered

- **Clerk.** Hosted UI and user management, but an external vendor holding user data, per-user cost, and no OAuth server for MCP clients. Rejected.
