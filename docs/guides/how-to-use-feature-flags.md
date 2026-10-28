# How to use feature flags

How feature flags work in this starter: the catalog in code, how a feature and the browser read a flag, how targeting rules and percentage rollouts evaluate, how admins change a flag, where flags are stored (`FEATURE_FLAGS`), how a flag is removed, and how to plug in LaunchDarkly or PostHog instead of D1. Also what a flag is not: an entitlement or a permission. Use when you add, evaluate, roll out or remove a feature flag, change `FEATURE_FLAGS`, or connect a flag vendor.

## Flags, entitlements and permissions

Three different questions, three different mechanisms. Mixing them up is a review finding ([code-review.md checklist 1](../processes/code-review.md#1-server-side-architecture)).

| Concept      | Answers                                       | Lives                                                  | Lifetime                               |
| ------------ | --------------------------------------------- | ------------------------------------------------------ | -------------------------------------- |
| Feature flag | Is this release or operations switch on here? | The catalog (`FLAGS`) plus a provider (D1 or a vendor) | Temporary: every flag has `removeWhen` |
| Entitlement  | What did this workspace's plan pay for?       | The plan and billing data (not built yet)              | As long as the plan exists             |
| Permission   | May this user's role do this?                 | Roles and authorization checks in procedures           | As long as the role model exists       |

A flag can be wrong for a moment (a cache, a vendor outage) and resolves to its catalog default when the provider fails. That is fine for a release switch and wrong for anything someone pays for or anything that protects data. So never gate a paid feature or an authorization check on a flag; a `plan` rule may target a rollout at a plan, but the plan's entitlement is still checked on its own.

## The catalog

Every flag the code reads is an entry in `FLAGS` in [`packages/features/src/feature-flags/domain/catalog.ts`](../../packages/features/src/feature-flags/domain/catalog.ts):

```ts
export const FLAGS = {
  "upload-demo-presigned": {
    type: "boolean", // boolean | string | number
    default: true, // the value when the flag is off, unconfigured, or the provider fails
    owner: "platform", // who removes it
    removeWhen:
      "the upload demo keeps a single upload path, or both paths are kept for good",
    rolloutBy: "workspace", // percentage rollouts bucket by workspace or by user
    client: true, // sent to the browser by flags.client
    description:
      "Shows the presigned (browser to R2) upload card next to the Worker upload on the upload demo page.",
  },
} as const satisfies Record<string, FlagDefinition>;
```

Keys are kebab-case. The type and default live only here: call sites cannot ask for another type or invent a default. CI enforces the rest (`test/architecture/feature-flags.test.ts` and `lint/rules/flag-key-literal.grit`):

- every key passed to `evaluateFlag`, `useFlag` or `<FlagGate flag>` is in `FLAGS`;
- every `FLAGS` entry is used somewhere, so a removed feature takes its flag with it;
- every entry has an `owner` and a `removeWhen`;
- keys are string literals at the call site, so a search finds every use;
- only `packages/features/src/feature-flags/` and the platform call the `FeatureFlags` port.

## Reading a flag

**In a feature (server).** Use cases receive the provider as a dependency and call `evaluateFlag`, never the port:

```ts
import { evaluateFlag } from "../feature-flags";

const { value } = await evaluateFlag(deps.flags, "upload-demo-presigned", {
  userId,
  workspaceId,
  plan: null,
  environment,
});
```

It returns OpenFeature evaluation details (`value`, `variant`, `reason`, `errorCode`, `flagMetadata`) and never throws. In a `workspaceProcedure`, the subject comes from the workspace actor: `ctx.actor.userId`, `ctx.actor.workspaceId`, `ctx.config.APP_ENV`; `plan` is null until plans exist.

**In the browser.** Only flags with `client: true` reach the browser, as values, through `flags.client` (`get_client_flags` over MCP), a workspace procedure: members only, for the workspace they name (or their current one); a workspace they do not belong to is `NOT_FOUND`. `apps/web/src/lib/feature-flags.tsx` loads them under `FeatureFlagsProvider` (mounted in `AppSpa.tsx` inside `WorkspaceProvider`) for the active workspace, and again when it changes:

```tsx
import { FlagGate, useFlag } from "@/lib/feature-flags";

<FlagGate flag="upload-demo-presigned" fallback={<OldCard />}>
  <NewCard />
</FlagGate>;

const layout = useFlag("file-list-layout"); // the catalog default until the flags load
```

Until the flags load, and if loading fails, every flag has its catalog default (`CLIENT_FLAG_DEFAULTS` in `apps/web/src/lib/client-flag-defaults.ts`, kept equal to the catalog by its test), the same value the server gives when its provider fails. Add a new client flag's default there too. Components in `packages/ui` never read flags; the app decides and passes props.

## Evaluation

A provider resolves a flag for an evaluation context (`targetingKey`, `userId`, `workspaceId`, `plan`, `environment`). The D1 and memory providers evaluate stored configuration with `evaluateStoredFlag` ([`platform/flag-evaluation.ts`](../../packages/features/src/platform/flag-evaluation.ts)), in [OpenFeature](https://openfeature.dev/specification/types) terms:

| Stored configuration                              | Value            | Reason / error code                             |
| ------------------------------------------------- | ---------------- | ----------------------------------------------- |
| None for this key                                 | catalog default  | `ERROR` / `FLAG_NOT_FOUND`                      |
| `enabled: false`                                  | catalog default  | `DISABLED`                                      |
| First matching rule: workspace or plan            | the rule's value | `TARGETING_MATCH`                               |
| First matching rule: percentage                   | the rule's value | `SPLIT`                                         |
| No rule matches, fallthrough set                  | fallthrough      | `DEFAULT` (`STATIC` when the flag has no rules) |
| No rule matches, no fallthrough                   | catalog default  | `DEFAULT`                                       |
| A matching value of another type than the catalog | catalog default  | `ERROR` / `TYPE_MISMATCH`                       |
| Stored JSON that does not parse                   | catalog default  | `ERROR` / `PARSE_ERROR`                         |
| The provider failed (D1 down)                     | catalog default  | `ERROR` / `GENERAL`                             |

Rules apply in order. A **percentage** rule matches when the bucket of the targeting key is below `percentageBp` (basis points, 0–10000): bucket = FNV-1a 32 of `${flagKey}:${targetingKey}` mod 10000. The bucket is stable across isolates, deploys and providers, so growing a rollout from 10 % to 50 % keeps the first 10 % in; salting with the flag key keeps two rollouts from picking the same ids. The targeting key is the workspace id or the user id, per the flag's `rolloutBy`; without one (an anonymous visitor, a user without a workspace), percentage rules do not match. A **workspace** rule matches one workspace id, a **plan** rule one plan id.

Plans are not built yet: `plan` is null in every request, so plan rules match nobody until plans exist.

## Changing a flag

Admins change flags through tRPC procedures with MCP tools:

| Procedure              | MCP tool                 | Does                                                                   |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `admin.flags.list`     | `list_feature_flags`     | Every catalog flag with its stored switch, fallthrough and rules       |
| `admin.flags.update`   | `update_feature_flag`    | Switches a flag on or off and sets its fallthrough (null: the default) |
| `admin.flags.setRules` | `set_feature_flag_rules` | Replaces the ordered rules (workspace, plan, percentage)               |

Only catalog flags can be configured, with values of their catalog type. Changes reach the isolate that made them at once and every other isolate within 30 seconds (the D1 provider's cache).

A flag whose stored JSON does not parse (after hand-written SQL) resolves to its default with `PARSE_ERROR`, and `admin.flags.list` shows it as `stored: { invalid: true, error, … }`. A write repairs it: `update` sets the switch and fallthrough and drops rules that do not parse; `setRules` replaces the rules and resets a fallthrough that does not parse to null (the default).

They are `adminProcedure`s of the admin portal (`apps/web/src/server/trpc/admin-router.ts`): platform admins only, with `ADMIN_PORTAL=on`; everyone else gets `NOT_FOUND` ([how-to-use-admin-portal.md](how-to-use-admin-portal.md)). Every write records an audit event with the admin as actor and no workspace: `feature_flag.updated` (`enabled`, `fallthrough`) and `feature_flag.rules_changed` (`ruleCount`, `ruleKinds`; rule targets stay out of the log) ([how-to-use-the-audit-log.md](how-to-use-the-audit-log.md)). The `FlagRuleEditor` and `PercentageInput` components in `packages/ui` are ready for the admin pages.

To change a flag before then, use SQL on the environment's D1 (`feature_flags`, `feature_flag_rules`; values are JSON):

```bash
cd apps/web && bunx wrangler d1 execute DB --local --command \
  "INSERT INTO feature_flags (key, enabled, fallthrough_json, updated_at, updated_by) VALUES ('upload-demo-presigned', 1, 'false', unixepoch() * 1000, 'sql')
   ON CONFLICT(key) DO UPDATE SET enabled = 1, fallthrough_json = 'false', updated_at = unixepoch() * 1000"
```

## FEATURE_FLAGS

The required var that picks the provider in `apps/web/src/server/platform.ts`, validated by `parsePlatformConfig` in `apps/web/src/lib/config.ts` and checked by `bun run doctor`. No default: every environment of `apps/web/wrangler.jsonc` states it.

| Value  | Provider                                                                                                                             | Admin procedures                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `d1`   | `createD1FeatureFlags`: tables `feature_flags` and `feature_flag_rules` in `DB` (platform configuration, exempt from `workspace_id`) | Work (for admins)                                |
| `none` | `noopFeatureFlags`: every flag is its catalog default                                                                                | `PRECONDITION_FAILED`: flags are not stored here |

A missing or unknown value fails every request with a 500 naming the setting. To override locally, add `FEATURE_FLAGS=none` to `apps/web/.dev.vars`; never leave the line blank.

The D1 provider loads every flag with its rules in one query and serves them from memory for 30 seconds per isolate ([performance.md](../architecture/performance.md#feature-flags)). It needs the tables from `packages/features/migrations/0000_init.sql`: a local D1 migrated before they existed answers every flag with its default (`GENERAL`) until you recreate it (`rm -rf apps/web/.wrangler/state/v3/d1 && bun run db:migrate:local`).

## Adding a flag

1. Add the entry to `FLAGS` with a type, default, owner, `removeWhen`, `rolloutBy`, `client` and description. The default is the behaviour today: a new code path starts off.
2. Read it with `evaluateFlag` (server) or `useFlag` / `FlagGate` (browser, `client: true`), with the key as a string literal.
3. Test both values: pass `createMemoryFeatureFlags()` with the flag configured to the use case, never a mocked provider ([testing.md](../architecture/testing.md#change--required-test)).
4. Roll out with rules (a workspace first, then a percentage), switch off with `enabled: false`. For a `client: true` flag, add its default to `CLIENT_FLAG_DEFAULTS`.

## Removing a flag

When `removeWhen` holds: delete the losing branch and every `evaluateFlag` / `useFlag` / `FlagGate` call for the key, then the `FLAGS` entry (CI fails while either is left without the other), and delete the flag's rows (`DELETE FROM feature_flags WHERE key = '…'`; its rules cascade) in each environment. A stored row for a key that left the catalog is ignored and not listed.

## Using LaunchDarkly or PostHog

The `FeatureFlags` port ([`platform/ports/feature-flags.ts`](../../packages/features/src/platform/ports/feature-flags.ts)) is OpenFeature-shaped, so a vendor's [OpenFeature server provider](https://openfeature.dev/ecosystem) maps onto it almost one to one. Sketch for LaunchDarkly (PostHog is the same with its provider):

1. `bun add @launchdarkly/openfeature-node-server @openfeature/server-sdk` in `packages/features` (justify it per [dependencies.md](../processes/dependencies.md)); check the SDK runs on Workers (`nodejs_compat`) or use the vendor's edge SDK.
2. `packages/features/src/platform/adapters/launchdarkly/launchdarkly-feature-flags.ts` exporting `createLaunchDarklyFeatureFlags({ sdkKey })`: create the OpenFeature client with the vendor provider and implement each `get*Details` by calling the client's `get*Details(key, defaultValue, { targetingKey, userId, workspaceId, plan, environment })`, mapping the result fields one to one and catching anything thrown into `reason: "ERROR"`. No store: flags are managed in the vendor's dashboard.
3. `launchdarkly-feature-flags.contract.test.ts` calling `describeFeatureFlagsContract` (`.contract.integration.test.ts` if it needs workerd), with the vendor's test data source.
4. `"launchdarkly"` in `FEATURE_FLAG_PROVIDERS` (`apps/web/src/lib/config.ts`), a branch in `buildPlatform` with `flagStore: null`, the value in `wrangler.jsonc` and `scripts/doctor.ts`, the SDK key as a secret (`.dev.vars.example`, `scripts/setup-secrets.ts`).
5. Create each catalog key in the vendor with the same type; the catalog stays the source of truth for keys, types, defaults and removal. Vendor SDKs stay inside the adapter folder (dependency-cruiser `vendor-sdks-only-in-adapters`).
