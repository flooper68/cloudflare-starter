# Let agents use your app

::reviewed{date="2026-11-08"}

Claude, or any agent that speaks MCP, signs in as one of your users and does what that person can do, after a consent page in plain words. People see every agent they allowed and cut one off in a click.

::video{id="agents" poster="connected-agents" title="Agents & MCP in 75 seconds"}

## Where to find it

:::screenshot{shot="connected-agents" alt="Settings › Connected agents, listing the demo MCP client"}
- What the agent may do, in the words of the consent page
- **Disconnect** ends access from the agent's next call

:::

## How it works

::flow[Agent asks -> You allow -> Token for your account -> Tool calls -> Disconnect]{title="Agent access: the agent asks, you allow, it calls tools as you until you disconnect it"}

- The agent registers itself and opens your app's sign-in. You sign in and see what it asks for, in words.
- It gets a token for `/mcp`, tied to you and to the browser that allowed it. Every call reloads both, so your workspaces and permissions apply as in the browser.
- Every action the app can do has a tool. A test fails the build when one is missing.

## Turn it on

It is on in every deployed environment: there is nothing to set. Agents connect from the internet, so they need a deployed app (HTTPS), not `localhost`.

:::prompt{title="Paste this into your coding agent"}
```text
Connect Claude to my deployed app: tell me the connector URL to add in Claude
(<APP_URL>/mcp for the environment I name), then walk me through signing in and
allowing it, and check that the whoami tool answers.
```
:::

:::steps
1. **Add a custom connector in Claude** with the URL `https://<your-app>/mcp`.
2. **Sign in and allow it.** The consent page names the agent, your address and what it may do.
   ::shot{id="consent" alt="The consent page an agent shows before it gets access"}
3. **Ask it something.** "List my notes" calls `list_notes` in your current workspace.

:::

## Use it

:::tabs
```text title="In the app"
Settings › Connected agents
  See each agent, what it may do and when it connected.
  Disconnect: confirm, and its next call is refused.
```
```ts title="API"
// The same procedures the tools call, from the app's typed client.
const agents = await trpc.account.agents.list.query();
await trpc.account.agents.disconnect.mutate({ clientId: agents[0].clientId });
```
```json title="MCP"
{ "method": "tools/call", "params": { "name": "list_connected_agents", "arguments": {} } }
{ "method": "tools/call", "params": { "name": "disconnect_agent", "arguments": { "clientId": "…" } } }
```
:::

:::decision{title="Why access ends at once"}
Every call to `/mcp` checks that your consent for that agent still exists and is older than its token. Disconnecting deletes the consent, so even an unexpired token is refused from its next call.
:::

:::gotcha{title="Agents can't reach localhost"}
Claude connects from Anthropic's servers. Try the full flow on your develop environment; locally, `bun run test` covers the tools.
:::

:::gotcha{title="An agent can disconnect itself"}
The call that does it completes; the next one is refused. It only ever removes access.
:::

## Limits

- Agents get your permissions, never more: an owner's agent can manage members, a member's cannot.
- Account erasure, second-factor reset and impersonation stay in the browser; they have no tools.
- Admin tools need a sign-in from the last 15 minutes for destructive actions ([Admin](admin.md)).
- Content your users wrote comes back marked as data, not instructions, so an agent does not obey a note.

## Related

- [Add an agent tool](../reference/mcp.md#adding-a-tool) and the parity rule
- [Accounts and security](accounts.md): tokens tied to the browser that allowed them
- [Notes](notes.md): the tools of the example feature
