# How to configure plans and billing

::reviewed{date="2026-11-09"}

Sell plans, run trials and limit usage per workspace without writing billing code. Plans live in a catalog in code; a feature asks the billing gate before it acts; people who hit a limit see what to upgrade to. Start with billing off or manual and plug in a payment provider later. What people see: [Plans, trials and usage limits](../features/billing.md).

::flow[Define plans -> Choose the mode -> Gate a feature -> Upgrade prompt]{title="Billing set-up: define the plans, choose the mode, gate features in use cases, people see upgrade prompts at a limit"}

## Choose the mode

:::settings
- BILLING = manual (off | manual | provider) Everything unlimited; plans an admin assigns; or a payment provider adapter
  :::

`bun run setup:auth --env <env>` asks for it with the workspace settings; deployed environments have no default. Switching `off` to `manual` later is safe.

:::prompt{title="Paste this into your coding agent"}
```text
Set BILLING=manual for every environment with the setup-auth skill (dry run first).
Then replace the example plans in packages/features/src/billing/domain/catalog.ts with
<my plans and limits>, mirror the names in apps/web/src/lib/billing-catalog.ts, and run
the tests.
```
:::

## Gate a feature or limit a metric

:::steps
1. **Add the key** to `FEATURES` or `METRICS` in the catalog, and a limit for a new metric to every plan.
2. **Ask the gate in the use case**, after the permission check: `requireFeature(workspaceId, key)` or `requireLimit(workspaceId, metric, increment)`; a monthly metric also calls `recordUsage`.
3. **Show the prompt** where the action runs: render `<BillingLimitPrompt refusal={limitRefusalOf(error)} />` when the call is refused.
4. **Test the refusal**: `test/architecture/entitlements.test.ts` fails until every key is required, limited and tested.
   ::shot{id="billing" alt="Billing: the plan, trial and usage meters"}
   :::

:::decision{title="Why the catalog is code, not a dashboard"}
Plans gate features in code, so a plan change is reviewed and tested with the features it affects.
:::

:::gotcha{title="The starter ships no payment provider"}
`provider` needs an adapter you write ([sell online](../reference/billing.md#sell-online-a-provider-adapter)); until then `manual` sells by hand.
:::

## Help one workspace

Platform admins open the workspace in **Admin › Workspaces**: assign a plan or a trial, set add-ons, or override a feature or a limit with a reason. Overrides win over the plan; use them for exceptions.

## Reference

The catalog, what a refusal looks like, the billing page and prompts, modes, trials and lapses, admin tools, a provider adapter with a Stripe sketch, the webhook and the tables: [Billing reference](../reference/billing.md).
