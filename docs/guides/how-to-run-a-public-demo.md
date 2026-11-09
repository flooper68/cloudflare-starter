# How to run a public demo

::reviewed{date="2026-11-09"}

Demo mode turns a deployment into a public demo anyone may sign up to: a notice says accounts are deleted after a few days, new workspaces get sample notes, and a daily job warns each account a day before it is due and then erases it through the real privacy erasure. Use this guide to turn it on or off, change the retention, or protect an account.

> **Starter-only, removed by `starter:strip`** (`demo-mode`): apps built from the starter keep `DEMO_MODE=off` everywhere, because real users' accounts must never expire.

::flow[Sign up -> Sample notes -> Warning the day before -> Erased after the retention]{title="Demo account life: sign-up, sample notes, a warning the day before, erasure after the retention"}

## Turn it on

:::settings
- DEMO_MODE = off (off | on) The public demo; with off nothing else here is read
- DEMO_RETENTION_DAYS = 7 Days before an account is erased, 2 to 365
- DEMO_SAMPLE_DATA = on (on | off) New personal workspaces get the sample notes
- DEMO_PROTECTED_EMAILS = none Accounts never erased, comma separated, up to 50
  :::

:::gotcha{title="Before turning it on over an existing deployment"}
List every account to keep in `DEMO_PROTECTED_EMAILS` (platform admins and `BOOTSTRAP_ADMIN_EMAIL` are kept anyway). The first daily run warns every other account old enough, and the next one erases them.
:::

:::byhand
1. Set the four vars in the environment's `vars` in `apps/web/wrangler.jsonc`.
2. Deploy. Admins see the values on `/admin/settings` (**Demo mode**).
   :::

## What people see

- A notice above the sign-up form and a dismissable banner in the app: "Demo instance: your account and data are deleted after 7 days."
- Three `Sample: …` notes in their new workspace.
- The day before: **Your demo account will be deleted tomorrow**, in the inbox and by email, with a link to export their data.
- After: the usual **Your account was deleted** mail.

:::decision{title="Erased through the real pipeline"}
Demo accounts go through the same erasure as an admin's, so last-owner and last-admin checks, file clean-up and audit redaction apply. At most 100 erasures a day; a backlog drains over the following days.
:::

## Reference

The settings in full, the retention rules step by step, the admin overview, debugging, tests and removing demo mode: [Public demo reference](../reference/public-demo.md).
