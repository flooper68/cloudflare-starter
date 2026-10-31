# How To Configure Plans And Billing

Plans, add-ons, gated features and usage limits per workspace, and how a project sells them: the catalog in code, the `BILLING` setting, trials, admin overrides, the daily expiry cron, the billing page and upgrade prompts in the app, the admin portal's billing panel, and how to plug in a payment provider (a Stripe adapter is sketched below; the starter ships none). Use when you define or change plans, gate a feature or limit something, choose a billing mode for an environment, change or add an upgrade prompt, write a provider adapter, or debug a `limit_reached` error.

The rules (permission, entitlement, flag) are in [overview.md](../architecture/overview.md#plans-features-and-limits). Everything is reachable through tRPC and MCP, and in the browser ([In the app](#in-the-app-billing-page-upgrade-prompts-trial-banner), [Admin](#admin-plans-add-ons-and-overrides)).

## The catalog

`packages/features/src/billing/domain/catalog.ts` holds everything that can be sold, as code (reviewed, tested, versioned with the features it gates):

| Name                    | What it is                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `FEATURES`              | Gated capabilities, e.g. `files.presigned_upload`                                                                                        |
| `METRICS`               | Limited quantities: `{ kind: "current" \| "period", source, reset?, unit }` (below)                                                      |
| `PLANS`                 | `{ id, name, features, limits, trialDays?, fallbackPlanId, internal? }`; every plan states a limit for every metric (`null` = unlimited) |
| `ADDONS`                | `{ id, name, features?, limits? }`: features granted and limits raised per unit of quantity                                              |
| `UNLIMITED_PLAN`        | Every feature, no limits: every workspace's plan with `BILLING=off`. `internal`: never offered for sale, assignable by an admin          |
| `NEW_WORKSPACE_PLAN_ID` | The plan a new workspace starts on (with its trial)                                                                                      |
| `DEFAULT_PLAN_ID`       | The plan of a workspace without a subscription (created before billing was turned on)                                                    |
| `PAST_DUE_GRACE_DAYS`   | How long an unpaid subscription keeps its plan after its period ended                                                                    |

The shipped plans (`free`, `pro` with a 14-day trial, `unlimited`) and add-ons (`extra_storage`, `extra_seats`, `direct_uploads`) are examples: replace them. `validateCatalog` (run by `catalog.test.ts` and `test/architecture/entitlements.test.ts`) refuses duplicate ids, a fallback that does not exist or has a trial of its own, a plan without a limit for some metric, unknown feature or metric keys in plans and add-ons, and a metric without a source.

The browser keeps its own copy of what it shows: plan and add-on names, which plans have a trial or are internal, and the words for each feature and metric, in `apps/web/src/lib/billing-catalog.ts` (so the SPA bundle does not pull in the server package). `billing-catalog.test.ts` fails when it drifts from the catalog: change both together.

Metrics:

- **current**: measured on demand from the owning feature's tables. `source` is `<feature>.<function>`, a function the features package exports, mapped in `billing/measure-metric.ts`. Shipped: `storage_bytes` (`files.measureWorkspaceStorage`, the sum of `files.size_bytes`, files in the trash included until they are purged: [how-to-use-trash.md](how-to-use-trash.md#billing)) and `seats` (`workspaces.countWorkspaceSeats`, members plus pending invitations, so invitations cannot get around the limit; checked when an invitation is created, and in single mode when a sign-up would join the app's workspace on its own (open sign-up or an allowed domain): the sign-up is refused with `LIMIT_REACHED` and the message "This workspace has no free seats…" (`checkSignUpAllowed`). The bootstrap admin is never refused, and someone with a pending invitation already holds a seat).
- **period**: a counter per workspace and calendar month (UTC) in `usage_counter`. `source` is `usage_counter`; the owning use case calls `billing.recordUsage` after the action. A new month starts a new row, so counters reset without a job. Shipped: `files.uploads_per_month`.

### Gate a feature or limit a metric

1. Add the key to `FEATURES` or `METRICS`, and a limit for a new metric to every plan.
2. In the use case, after the permission check, ask the `BillingGate` the use case receives as `deps.billing`:

   ```ts
   requirePermission(actor, "files.write"); // who may act
   await deps.billing.requireFeature(actor.workspaceId, "files.presigned_upload"); // what was bought
   await deps.billing.requireLimit(actor.workspaceId, "storage_bytes", input.sizeBytes);
   // … the change …
   await deps.billing.recordUsage(actor.workspaceId, "files.uploads_per_month", 1); // period metrics only
   ```

   The gate is an interface in `kernel/billing-gate.ts`, built per request by `billingGateFor` (`apps/web/src/server/billing-provider.ts`), which calls billing's `createBillingGate`, so features that billing reads from (files, workspaces) call it without an import cycle. For a current metric, export its measuring function from the owning feature and map it in `measure-metric.ts`.
3. Add an integration or API test that expects the refusal (`limit_reached`) with the key: `test/architecture/entitlements.test.ts` fails until every feature is required, every metric limited (and counted, for period metrics) by a use case outside billing, every current source resolves, and every key has such a test.

Limits are check-then-act: two requests at once can overshoot a limit by what they add together. That is fine for quotas; anything that must never overshoot needs a Durable Object or a conditional write.

### What a refusal looks like

The gate throws `LimitReachedError` (code `LIMIT_REACHED`) or `FeatureNotIncludedError` (code `FEATURE_NOT_INCLUDED`), both of kind `limit_reached`, with `details`:

```json
{
  "metric": "seats",
  "limit": 3,
  "current": 3,
  "increment": 1,
  "planId": "free",
  "upgrade": { "planIds": ["pro"], "addonIds": ["extra_seats"] }
}
```

(`feature` instead of the metric fields for a gated feature.) `upgrade` lists the customer plans that would cover the need and the add-ons that grant or raise it. Transports:

| Transport      | Shape                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| tRPC           | `FORBIDDEN`, `error.data.appCode` (`LIMIT_REACHED`), `error.data.domain = { kind: "limit_reached", details }`                    |
| MCP tool error | `{ error: { code: "FORBIDDEN", httpStatus: 403, message, appCode, domain: { kind, details } } }`                                 |
| `/api/files`   | 403 Problem Details (`application/problem+json`, title `Limit Reached`) with `kind`, `code` and the details as extension members |

## In the app: billing page, upgrade prompts, trial banner

With `BILLING` other than `off` (the SPA reads the mode from the page's bootstrap, `billing.mode` in `apps/web/src/server/spa-bootstrap.ts`):

| Where                                                          | What                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Billing** in the sidebar, `/app/billing` (`BillingPage.tsx`) | The plan (`PlanCard`: name, state, trial days left, key limits, features and add-ons) and a `UsageMeter` per metric, from `workspace.billing.summary`. Provider mode: owners get **Switch to …** (checkout) and **Manage billing** (customer portal); manual mode: "contact your admin" |
| Uploads (`/app/upload-demo`, both paths)                       | A refused upload shows the upgrade prompt instead of an error: the binding path from the 403 Problem Details body, the presigned path from the tRPC error                                                                                                                               |
| Invitations (`/app/members`)                                   | No free seat: the invite dialog closes and the upgrade prompt opens as a dialog                                                                                                                                                                                                         |
| The app shell (`TrialBanner.tsx`)                              | A banner while a trial ends within 7 days, and for 7 days after a trial ended on a known trial fallback plan; loading and failed checks show a skeleton or retryable error; dismissible per workspace until the next page load                                                          |

With `BILLING=off` there is no Billing entry, `/app/billing` says billing is off, and no prompt renders. What a prompt offers depends on the mode and the person: in provider mode owners (`billing.manage`) get a button per upgrade option (the refusal's `upgrade.planIds`, then `upgrade.addonIds`; each opens `workspace.billing.checkoutUrl`, an add-on as one unit on the current plan) and members are told to ask an owner; in manual mode everyone is told to contact the admin.

The pieces:

- `packages/ui`: `UpgradePrompt` (`components/upgrade-prompt.tsx`; reasons `limit`, `feature`, `trial-ending`, `trial-ended`; variants `callout`, `banner`, `dialog`), `UsageMeter` (`components/usage-meter.tsx`; amber from 80 % of the limit, red at and past it, no bar when unlimited) and `PlanCard` (`components/patterns/plan-card.tsx`), with a story per state (Storybook: Feedback/UpgradePrompt, Data display/UsageMeter, Patterns/Billing/PlanCard).
- `apps/web/src/lib/billing-prompts.ts` (unit-tested): `limitRefusalOf(error)` reads a refusal from a tRPC error (`data.appCode`, `data.domain`) or a Problem Details body and returns null for anything else; `upgradePromptFor(refusal)` turns it into the prompt's reason and options; `trialNotice(summary, now)` decides the trial banner.
- `apps/web/src/components/app/billing/`: `BillingLimitPrompt` (a refusal → the prompt, with a link to the billing page), `TrialBanner`, and `useUpgrade` (mode, who may buy, the checkout).

The billing page is self-contained (`BillingPage` loads its own data), so a settings area can mount it as one of its sections.

### Customise the prompts

- **Words for plans, add-ons, features and metrics**: `apps/web/src/lib/billing-catalog.ts` (`subject` is the lower-case word inside sentences, "You've reached the storage limit"; `label` the title-case one on meters).
- **Sentences and tone**: `title`, `situation` and `nextStep` in `packages/ui/src/components/upgrade-prompt.tsx`; update its stories with them.
- **Which options a refusal offers**: the server's `upgradeOptions` (`billing/domain/upgrade.ts`); the prompt shows them in that order, plans first.
- **When the trial banner shows**: `TRIAL_NOTICE_DAYS` and `trialNotice` in `billing-prompts.ts`.
- **A prompt for a new limit or feature**: once the use case asks the `BillingGate` (above), catch the call's error where the action runs and render `<BillingLimitPrompt refusal={refusal} />` when `limitRefusalOf(error)` is not null (`variant="dialog"` when the action ran in a dialog). Add the new key's words to `billing-catalog.ts`.

## Billing modes

`BILLING` is required and has no default. `bun run setup:auth --env <env>` asks for it with the workspace settings and writes it into the environment's vars in `wrangler.jsonc`; `apps/web/src/lib/config.ts` refuses to start without a valid value; `bun run doctor` checks it. Locally it comes from `apps/web/.dev.vars` (`.dev.vars.example` has `manual`).

| Mode       | Entitlements                                                                | Trials | Checkout and portal                 | Webhook |
| ---------- | --------------------------------------------------------------------------- | ------ | ----------------------------------- | ------- |
| `off`      | `UNLIMITED_PLAN` for everyone, no query; no usage counted                   | none   | `PRECONDITION_FAILED`               | 404     |
| `manual`   | the subscription an admin assigns (or the default plan), add-ons, overrides | yes    | `PRECONDITION_FAILED`               | 404     |
| `provider` | the subscription the provider reports, add-ons, overrides                   | yes    | the provider adapter's hosted pages | on      |

Switching `off` → `manual` later is safe: workspaces without a subscription get `DEFAULT_PLAN_ID`. Assign plans first (below) if existing workspaces should keep more.

## Trials and lapses

- **Start.** When a workspace is created (sign-up provisioning, `workspace.create`, the single-mode workspace), `startTrial` puts it on `NEW_WORKSPACE_PLAN_ID`: `trialing` until `trialDays` later, or `active` if the plan has no trial. No card is needed; in provider mode the customer checks out before the trial ends.
- **Lapse.** A trial that ended, a `past_due` subscription `PAST_DUE_GRACE_DAYS` after its period, and a `canceled` one at its period end fall back to the plan's `fallbackPlanId`, `active`. Entitlements apply this on read at once; the daily cron entry `billing.expire-trials` (`17 3 * * *`, `packages/features/src/cron-catalog.ts`) enqueues the job of the same name (`asOf`: the run's time), whose handler in `job-catalog.ts` runs `expireTrials`, which writes it and records `billing.plan_lapsed`. It is idempotent: each update is conditional on the state it read, so a webhook arriving meanwhile wins, and a retry or a second run finds nothing. Jobs, retries and the dead-letter queue: [how-to-add-background-jobs.md](how-to-add-background-jobs.md).

Run the cron locally (with `bun run dev:web` running):

```bash
curl "http://localhost:4321/cdn-cgi/handler/scheduled?cron=17+3+*+*+*"
```

## Admin: plans, add-ons and overrides

Platform admins (`adminProcedure`: role admin with `ADMIN_PORTAL=on`, else `NOT_FOUND`; [how-to-use-admin-portal.md](how-to-use-admin-portal.md)) have `admin.billing.*` procedures and the matching MCP tools:

| Procedure                   | MCP tool                      | Does                                                                                                                   |
| --------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `admin.billing.get`         | `admin_get_workspace_billing` | Subscription, add-ons, overrides and the resulting entitlements of any workspace                                       |
| `admin.billing.usage`       | `admin_get_workspace_usage`   | Usage of every metric against its limit                                                                                |
| `admin.billing.assignPlan`  | `admin_assign_plan`           | Plan and status (`active`, or `trialing` until `trialEndsAt`); in provider mode the next provider event wins           |
| `admin.billing.setAddons`   | `admin_set_addons`            | Replaces the add-ons                                                                                                   |
| `admin.billing.setOverride` | `admin_set_override`          | Grants or revokes a feature, or sets a limit (`null` = unlimited), with a required reason; `override: null` removes it |

Overrides win over plan and add-ons; use them for exceptions (a pilot customer, a paused feature). Every change records a `billing.*` audit event ([how-to-use-the-audit-log.md](how-to-use-the-audit-log.md)).

In the portal, a workspace's page (`/admin/workspaces/<id>`) has a **Billing** panel (`AdminBillingPanel` in `packages/ui/src/components/patterns/admin-billing-panel.tsx`, loaded by `apps/web/src/components/admin/WorkspaceBilling.tsx`): the plan and its state, usage against every limit (overridden limits marked **Override**), and forms to assign a plan (active, or a trial until a day), set add-on quantities, and set or remove an override with its reason (byte limits are entered in MB). Hidden with `BILLING=off`; in provider mode it warns that the provider's next event replaces an assigned plan.

Members see their workspace's plan with `workspace.billing.summary` (MCP `get_billing_summary`, permission `billing.read`); owners (`billing.manage`) get `workspace.billing.checkoutUrl` and `workspace.billing.portalUrl` (MCP `get_checkout_url`, `get_billing_portal_url`, both `outward`).

## Sell online: a provider adapter

`BILLING=provider` needs a `BillingProvider` (`packages/features/src/platform/ports/billing-provider.ts`):

```ts
interface BillingProvider {
  readonly name: string; // stored as the subscription's provider
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  portalUrl(input: PortalInput): Promise<{ url: string }>;
  parseWebhook(request: Request): Promise<SubscriptionChange | null>; // invalid signature: throw DomainError("invalid_input", …)
}
```

Without a registered adapter, `BILLING=provider` fails every request with a ConfigError that names the fix. To add one:

1. Write `packages/features/src/platform/adapters/<vendor>/<vendor>-billing-provider.ts`, exported from its folder barrel and `adapters/index.ts`. Vendor SDKs are allowed only there ([overview.md principle 13](../architecture/overview.md#principles)); justify the dependency per [dependencies.md](../processes/dependencies.md).
2. Add `<vendor>-billing-provider.contract.test.ts` calling `describeBillingProviderContract` with a harness that builds signed, forged and ignored webhook requests (see `memory-billing-provider.contract.test.ts`).
3. Return it from `projectBillingProvider(env)` in `apps/web/src/server/billing-provider.ts`, built from the environment's secrets. Add the secrets to `apps/web/.dev.vars.example` and `scripts/setup-secrets.ts`.
4. Point the provider's webhook at `https://<host>/api/billing/webhook`.

### Stripe, sketched

Map catalog ids to Stripe prices in the adapter (a `PRICES` table: `pro` → `price_…`, `extra_seats` → `price_…`), and keep the workspace id in metadata so events can be mapped back:

- `createCheckout`: `stripe.checkout.sessions.create({ mode: "subscription", customer: customerId ?? undefined, customer_email: customerId ? undefined : customerEmail, line_items: [plan price, add-on prices × quantity], client_reference_id: workspaceId, subscription_data: { metadata: { workspaceId } }, success_url, cancel_url })` → `{ url: session.url }`.
- `portalUrl`: `stripe.billingPortal.sessions.create({ customer: customerId, return_url })`.
- `parseWebhook`: `stripe.webhooks.constructEventAsync(await request.text(), request.headers.get("stripe-signature"), STRIPE_WEBHOOK_SECRET)` (the async variant works on Workers; throw `invalid_input` when it fails). For `customer.subscription.created|updated|deleted`, return `{ workspaceId: sub.metadata.workspaceId, planId` from the price, `addons` from the other items, `status` (`trialing`, `active`, `past_due`; `canceled`, `unpaid` and `incomplete_expired` → `canceled`), period start and end, `trialEndsAt`, `provider: "stripe"`, `customerId`, `subscriptionId`, `occurredAt: new Date(event.created * 1000)` }; return `null` for other events.
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

Better Auth's Stripe plugin is an alternative inside such an adapter: it manages customers and subscriptions in its own tables and endpoints. If you use it, keep this port as the boundary (call the plugin from the adapter, translate its subscription events into `SubscriptionChange`) so entitlements keep reading `workspace_subscription` and the rest of the app does not change.

### The webhook

`POST /api/billing/webhook` (`apps/web/src/pages/api/billing/webhook.ts`, logic in `apps/web/src/server/billing-webhook.ts`) answers 404 unless `BILLING=provider`. It has no session or Origin check: the adapter's signature check is the authentication. A normalized change goes to `applySubscriptionChange`, which ignores events older than the stored state (`occurredAt` against `updated_at`), so redeliveries and out-of-order events are harmless, replaces the add-ons when the event lists them, and records `billing.subscription_changed`. Errors are Problem Details: 400 for a forged request, 404 for an unknown workspace, 500 with a `reference` otherwise; providers retry non-2xx answers. The route is rate limited per IP by `billing.webhook` (300 a minute) before the signature check ([how-to-configure-abuse-protection.md](how-to-configure-abuse-protection.md)).

## Tables

`packages/features/src/billing/billing.schema.ts`, all with `workspace_id` referencing `workspaces` (`ON DELETE CASCADE`):

| Table                    | Holds                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `workspace_subscription` | Plan, status (`trialing`, `active`, `past_due`, `canceled`), period, trial end, provider and its customer and subscription ids |
| `workspace_addon`        | Add-on id and quantity per workspace                                                                                           |
| `entitlement_override`   | `key`, `kind` (`feature` with `enabled`, or `limit` with `limit_value`, NULL = unlimited), `reason`, `created_by`              |
| `usage_counter`          | `metric`, `period` (`YYYY-MM`), `value`                                                                                        |
