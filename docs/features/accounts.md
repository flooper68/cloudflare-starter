# Sign-in, passkeys and two-factor

::reviewed{date="2026-11-08"}

Your users sign in with email and password, Google or a passkey, and protect the account with an authenticator app. Rate limits and a bot check sit in front of every sign-in, so you start safe without building any of it.

::video{id="accounts" poster="sign-in" title="Accounts & security in 70 seconds"}

## What your users see

::shot{id="sign-in" alt="The sign-in page with email, password and a passkey"}

:::screenshot{shot="settings-security" alt="Settings › Security: two-factor, passkeys and sessions"}
- **Two-factor**: an authenticator app, with one-time recovery codes
- **Passkeys**: sign in without a password

:::

## How it works

::flow[Sign up -> Verify email -> Sign in -> Second factor -> Your workspace]{title="Account flow: sign up, verify the email, sign in, complete the second factor, land in the workspace"}

- Each sign-in method is switched on per environment; at least one must be on.
- With two-factor on, an enrolled person always completes a code after the password, passkey or Google.
- Security notices (a new sign-in, a changed password or factor) always reach the person, by email and in the app.

## Turn it on

:::settings
- AUTH_EMAIL_PASSWORD = true (true | false) Email and password sign-in
- AUTH_REQUIRE_EMAIL_VERIFICATION = false (true | false) Ask new users to confirm their address first
- TWO_FACTOR = optional (off | optional | required-for-admins | required) Who must set up an authenticator
- PASSKEYS = on (on | off) Passkey sign-in
- TWO_FACTOR_TRUSTED_DEVICE_DAYS = 0 Days a browser may skip the code (0 to 30)

:::

Google turns on when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

:::prompt{title="Paste this into your coding agent"}
```text
Use the setup-auth skill: set up sign-in for the develop environment with email and
password plus Google, email verification on, two-factor required for admins and
passkeys on. Show me the dry run before you write anything.
```
:::

:::byhand
1. `bun run setup:secrets --env develop` sets `BETTER_AUTH_SECRET` (and Google's keys, if you use it).
2. `bun run setup:auth --env develop --dry-run`, then without `--dry-run`, writes the choices into `apps/web/wrangler.jsonc`.
3. `bun run doctor` checks every environment; deploy.

Details: [Set up sign-in](../guides/how-to-setup-auth.md) and [Account security](../guides/how-to-configure-account-security.md).
:::

## Use it

:::tabs
```text title="In the app"
Settings › Account    name, avatar, email change, linked accounts, locale, time zone
Settings › Security   authenticator, recovery codes, passkeys, your sessions
Settings › Appearance theme
```
```ts title="API"
const status = await trpc.account.security.status.query();
const sessions = await trpc.account.sessions.list.query();
```
```json title="MCP"
{
  "method": "tools/call",
  "params": { "name": "get_security_status", "arguments": {} }
}
```
:::

:::decision{title="Why a passkey still asks for the second factor"}
The passkey library does not require the device to verify the person, so a passkey alone is not treated as two factors. Enrolled people complete their code after a passkey, as after a password.
:::

:::gotcha{title="Changing the production hostname breaks passkeys"}
A passkey belongs to the app's hostname (`APP_URL`). Plan a hostname change: people sign in another way and add a new passkey.
:::

## Limits

- Ten failed code checks lock verification for 15 minutes.
- Sign-up, sign-in and password reset are rate limited per IP and pass a bot check ([abuse protection](../guides/how-to-configure-abuse-protection.md)).
- Factor management and admin recovery stay in the browser; agents only read the status.

## Related

- [Workspaces](workspaces.md): who may sign up
- [Let agents use your app](agents.md): agent tokens tied to the browser that allowed them
- [Security headers](../guides/how-to-configure-security-headers.md)
