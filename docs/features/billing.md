# Plans, trials and usage limits

::reviewed{date="2026-11-08"}

Sell plans from day one without writing billing code: each workspace has a plan, a trial and usage meters, and when someone hits a limit they see what to upgrade to instead of an error. Start with billing off or manual, and bring a payment provider later.

::video{id="workspaces" poster="billing" title="Workspaces, billing & admin in 90 seconds"}

## Where to find it

::shot{id="billing" alt="Billing: the plan, trial and usage meters"}

## How it works

::flow[New workspace -> Trial -> Usage meters -> Limit reached -> Upgrade prompt]{title="Billing flow: a new workspace starts a trial, usage is metered, at the limit people see an upgrade prompt"}

- Plans, add-ons and limits are code in one catalog, reviewed and tested like the features they gate.
- A feature asks the billing gate before it acts: "is this included?" and "is there room for one more?".
- A daily job ends trials on time; a lapsed plan falls back to its free plan.

## Turn it on

:::settings
- BILLING = manual (off | manual | provider) Everything unlimited, plans set by an admin, or a payment provider

:::

:::prompt{title="Paste this into your coding agent"}
```text
Set BILLING=manual for develop with the setup-auth skill, then change the plans in
packages/features/src/billing/domain/catalog.ts to Free (3 seats, 50 notes) and
Pro (14-day trial, unlimited). Update billing-catalog.ts to match and run the tests.
```
:::

:::byhand
1. `bun run setup:auth --env <env>` asks for `BILLING` with the workspace settings.
2. Edit the catalog (`catalog.ts`) and the browser's words for it (`apps/web/src/lib/billing-catalog.ts`); `bun run test` fails when they drift.
3. For `provider`, register an adapter in `apps/web/src/server/billing-provider.ts` ([sell online](../reference/billing.md#sell-online-a-provider-adapter)).

:::

## Use it

:::tabs
```text title="In the app"
Billing (sidebar)   the plan, trial days left, a meter per limit
Upgrade prompts     where a limit stops someone: uploads, invitations, notes
Admin › Workspaces  assign a plan, add-ons or an override with a reason
```
```ts title="API"
const summary = await trpc.workspace.billing.summary.query();
```
```json title="MCP"
{
  "method": "tools/call",
  "params": { "name": "get_billing_summary", "arguments": {} }
}
```
:::

:::compare
::before[An action past the limit fails with an error]
::after[It shows what to upgrade to, and owners can check out]
:::

:::decision{title="Why the catalog is code"}
Plans gate features in code. Keeping them in the same repository means a change to a plan is reviewed and tested with the features it affects.
:::

:::gotcha{title="The starter ships no payment provider"}
`provider` needs an adapter you write (a Stripe sketch is in the guide). `manual` sells by hand until then.
:::

## Limits

- Shipped plans (`free`, `pro`, `unlimited`) and add-ons are examples: replace them.
- In provider mode the provider's next event wins over a plan an admin assigned.

## Related

- [Configure plans and billing](../guides/how-to-configure-plans-and-billing.md): gate a feature, the refusal's shape
- [Workspaces](workspaces.md): seats
- [Admin portal](admin.md)
