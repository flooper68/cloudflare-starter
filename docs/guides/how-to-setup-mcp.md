# MCP: Using The App From Claude

Every web app built from this starter is also a remote [MCP](https://modelcontextprotocol.io) server at `<APP_URL>/mcp`. An MCP client such as Claude connects as the signed-in user and can do what that user can do in the web app, through tools.

## The Rule

> Anything the app can do over HTTP, an MCP client can do too.

Enforced by [apps/web/src/server/mcp/parity.test.ts](../../apps/web/src/server/mcp/parity.test.ts), which runs in `bun run verify` and CI:

- every tRPC procedure is used by an MCP tool, or listed in `MCP_EXEMPT_PROCEDURES` with a reason;
- every other HTTP endpoint (`.ts` files under `apps/web/src/pages`) is listed in `NON_TRPC_ROUTES` with a reason;
- tool names are unique snake_case with real descriptions, and single-procedure tools take exactly the procedure's input.

Reviews treat a new exemption as a design decision: it needs a reason a reviewer would accept, not "later".

## How It Works

| Piece                                                                                                       | Where                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| OAuth 2.1 server (dynamic client registration, PKCE, consent, JWT access tokens bound to `/mcp`)            | Better Auth `mcp()` + `jwt()` plugins in [server/auth.ts](../../apps/web/src/server/auth.ts) |
| Discovery (`/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server/api/auth`) | [pages/.well-known/[...path].ts](../../apps/web/src/pages/.well-known/[...path].ts)          |
| Sign-in during the flow                                                                                     | `/sign-in` (the OAuth client plugin carries the signed request through)                      |
| Consent                                                                                                     | [pages/consent.astro](../../apps/web/src/pages/consent.astro)                                |
| Endpoint: verifies the token, loads the user from D1, serves stateless Streamable HTTP                      | [server/mcp/handler.ts](../../apps/web/src/server/mcp/handler.ts)                            |
| Tools: thin adapters calling tRPC procedures in-process with `createCaller`                                 | [server/mcp/tools.ts](../../apps/web/src/server/mcp/tools.ts)                                |

Because tools call the same procedures with the same context, validation, auth checks and errors are identical to the web app by construction. Tool results wrap user data in `<untrusted-data>` so the model treats it as data, not instructions.

## Connect Claude

1. Deploy, so `APP_URL` is a public HTTPS origin.
2. In Claude, add a custom connector with the URL `<APP_URL>/mcp`.
3. Sign in and click Allow on the consent page.

Tokens are bound to `/mcp`, and the user is reloaded from D1 on every request, so deleting a user cuts access at once.

## Adding A Tool

1. Write the tRPC procedure first (logic, input schema, auth).
2. Add a tool in `tools.ts` with `direct(name, "read" | "write", "router.procedure", title, description)`. Describe it for the model: what it returns, when to use it, preconditions. Mark tools that send something outside the app with `{ outward: true }` and tools that remove access or data with `{ destructive: true }`, and say "confirm with the user" in the description. Tools on workspace data take an optional `workspaceId` (from `workspaceProcedure`); without it they act in the user's current workspace (`list_workspaces`, `switch_workspace`).
3. `bun run test`.

A tool may compose several procedures with a custom `run`; list them all in `procedures`.

## Testing

MCP is used against deployed environments only: Claude connects from Anthropic's servers and cannot reach `localhost`, and there is no local MCP setup. Locally, `bun run test` covers the tool layer (`server.test.ts` calls the MCP server in-process) and the parity rule; connect Claude to the develop environment to try the full flow.
