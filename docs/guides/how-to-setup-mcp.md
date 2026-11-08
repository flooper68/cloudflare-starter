# MCP: using the app from Claude

::reviewed{date="2026-11-09"}

Let Claude use your app. Every app built from the starter is also an agent endpoint at `<APP_URL>/mcp`: Claude, or any MCP client, signs in as one of your users and does what that person can do, through tools. Use this guide to connect Claude to an environment or add a tool. What people see: [Let agents use your app](../features/agents.md); every tool: [Agent tools](../reference/agent-tools.md).

::flow[Claude -> Sign in and allow -> Token for /mcp -> Tool call -> Your procedure]{title="Agent call: Claude signs in and is allowed, gets a token for /mcp, calls a tool, which runs your procedure"}

- **The rule:** anything the app can do over HTTP, an agent can do too.
- **Checked by** `apps/web/src/server/mcp/parity.test.ts`: a procedure without a tool and without a reason fails the build.
- **Works on deployed environments:** Claude connects from the internet; `localhost` is out of reach.

## Connect Claude

:::steps
1. **Deploy**, so `APP_URL` is a public HTTPS origin ([Deploy](../start/deploy.md)).
2. **Add a custom connector** in Claude with the URL `https://<your-app>/mcp`.
3. **Sign in and allow it.** The consent page names the agent, your address and what it may do.
   ::shot{id="consent" alt="The consent page an agent shows before it gets access"}
4. **Try it:** "List my notes" calls `list_notes` in your current workspace.
   :::

## Add a tool

Write the procedure first (logic, input schema, auth), then one line in `apps/web/src/server/mcp/tools.ts`:

:::tabs
```ts title="tools.ts"
// An example: a notes.archive procedure exposed as a tool.
direct(
  "archive_note",
  "write",
  "notes.archive",
  "Archive note",
  "Archives a note in the current workspace. Confirm with the user first."
),
```
```ts title="test"
// apps/web/src/server/mcp/server.test.ts calls the server in-process as a user.
const { body } = await rpc(context(), "tools/call", {
  name: "archive_note",
  arguments: { noteId },
});
expect(body.result.isError).toBeFalsy();
```
```bash title="curl"
curl -s https://<your-app>/mcp \
  -H "authorization: Bearer $TOKEN" -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"archive_note","arguments":{"noteId":"…"}}}'
```
:::

Mark a tool that sends something outside the app `{ outward: true }` and one that removes access or data `{ destructive: true }`, and say "confirm with the user" in its description. Then `bun run test`.

:::decision{title="Tools are thin"}
A tool calls the same procedure as the app, with the same context, so validation, permissions, limits and errors are identical by construction. Logic never lives in a tool.
:::

:::gotcha{title="A new exemption is a design decision"}
A procedure that should have no tool needs a reason a reviewer would accept in `MCP_EXEMPT_PROCEDURES`, not "later".
:::

:::compare
::before[Every exempt procedure and every admin tool listed inline in this guide]
::after[One generated table of every tool and exemption, always matching the code: Reference › Agent tools]
:::

## Reference

How it works, tokens tied to the browser that allowed them, how disconnecting works, and testing: [Agent endpoint reference](../reference/mcp.md).
