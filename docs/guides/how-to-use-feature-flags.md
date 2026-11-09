# How to use feature flags

::reviewed{date="2026-11-09"}

Ship a change switched off, turn it on for one workspace, one plan or a percentage, then remove the flag. Flags are a catalog in code; admins change them in the portal or through an agent. Every flag: [Catalogs › Feature flags](../reference/catalogs.md#feature-flags).

::flow[Add to the catalog -> Read it in the feature -> Roll out by rule -> Remove the flag]{title="Flag lifecycle: add it to the catalog, read it in the feature, roll it out by rules, remove it"}

::shot{id="admin-flags" alt="Feature flags in the admin portal"}

## Add and roll out a flag

:::steps
1. **Add it to `FLAGS`** in `packages/features/src/feature-flags/domain/catalog.ts`: type, default, owner, `removeWhen`, rollout key, whether the browser may read it.
2. **Read it**: in a use case through the flags port, in the app with `useFlag` or `<FlagGate>` when it is a browser flag.
3. **Roll it out** in **Admin › Feature flags**, or with `set_feature_flag_rules`: rules by workspace, plan or percentage, then the fallthrough.
4. **Remove it** when `removeWhen` is met: the code path, then the catalog entry.
   :::

:::prompt{title="Paste this into your coding agent"}
```text
Add a feature flag "new-editor" (boolean, default off, remove when the editor ships) to
the catalog, read it in the notes screen, and roll it out to 10% of workspaces with
set_feature_flag_rules on develop. Follow docs/guides/how-to-use-feature-flags.md.
```
:::

:::settings
- FEATURE_FLAGS = d1 (d1 | none) Flags stored in the database and changed by admins, or every flag at its catalog default
  :::

:::decision{title="Never gate a paid feature or a permission on a flag"}
A flag can be wrong for a moment (a cache, a vendor outage) and then falls back to its default. Fine for a release switch; wrong for anything someone pays for or anything that protects data.
:::

:::gotcha{title="Changes take up to 30 seconds"}
Other isolates cache the flags for 30 seconds.
:::

## Reference

Flags, entitlements and permissions; the catalog; reading a flag; evaluation; changing one (with SQL too); `FEATURE_FLAGS`; adding and removing; LaunchDarkly or PostHog: [Feature flags reference](../reference/feature-flags.md).
