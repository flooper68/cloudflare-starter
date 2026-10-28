# 0004. MCP server by default, with a parity test

- Status: Accepted
- Date: 2026-10-28

## Context

Products built from this starter are meant to be usable by AI agents as well as people. If agent access is added later, it lags the web app and gets a weaker, separately maintained auth path. An agent-facing API needs model-oriented descriptions, not just a schema dump.

## Decision

Every web app built from the starter is a remote MCP server at `/mcp`, authenticated with OAuth tokens from Better Auth ([0003](0003-better-auth-in-the-worker.md)). Tools are thin adapters in `apps/web/src/server/mcp/tools.ts` that call tRPC procedures in-process through `appRouter.createCaller`, with the token's user in the same context the web app uses. Each tool is written by hand with a description for the model.

`apps/web/src/server/mcp/parity.test.ts` fails the build when a tRPC procedure has neither a tool nor an entry in `MCP_EXEMPT_PROCEDURES`, or when an endpoint under `apps/web/src/pages` is not listed in `NON_TRPC_ROUTES`; every exemption needs a reason.

## Consequences

Positive:

- Anything a user can do in the web app, an agent acting as that user can do, from the first commit.
- Validation, authorization and errors are identical for web and MCP by construction.
- Forgetting a tool is a failing test, not a review comment.

Negative:

- Every new procedure costs a tool definition and a description.
- Tool results carry user data, so they are wrapped in `<untrusted-data>` and outward tools need a confirmation hint.
- Claude cannot reach `localhost`; full MCP testing needs a deployed environment or a tunnel.

## Alternatives considered

- **MCP tools calling the HTTP API.** An extra network hop and a second auth path (forwarding or minting session credentials). Rejected.
- **Auto-generating one tool per procedure.** No guidance for the model about when to use a tool, preconditions or confirmations; tool names follow router structure instead of user intent. Rejected.
