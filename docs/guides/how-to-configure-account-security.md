# Account security

::reviewed{date="2026-11-09"}

Choose who must set up two-factor, whether passkeys and emailed recovery codes are on, and how long a browser may skip the code. Use this guide to set the policy, recover someone's access, or understand why an agent's token or an admin action was refused. What people see: [Sign-in, passkeys and two-factor](../features/accounts.md).

::flow[Password, passkey or Google -> Second factor -> Session with evidence -> Fresh code for destructive admin actions]{title="Account security: any first factor, then the second factor, a session that remembers it, and a fresh code for destructive admin actions"}

## Set the policy

:::settings
- TWO_FACTOR = optional (off | optional | required-for-admins | required) Who must set up an authenticator
- TWO_FACTOR_EMAIL_OTP = off (on | off) Emailed codes as recovery, after an authenticator is set up
- TWO_FACTOR_TRUSTED_DEVICE_DAYS = 0 Days a browser may skip the code, 0 to 30
- PASSKEYS = on (on | off) Passkey sign-in
  :::

:::prompt{title="Paste this into your coding agent"}
```text
Use the setup-auth skill to set the account security policy for production: two-factor
required for admins, passkeys on, emailed recovery codes on, no remembered devices.
Dry run first, then run doctor.
```
:::

`bun run setup:auth --env <env> --dry-run` previews the choices; no deployed choice is shipped.

## Recover someone's access

An admin opens the person's page in **Admin › Users** and resets their second factor, in the browser, after a fresh sign-in. It removes the authenticator, recovery codes, remembered devices, sessions and agent tokens, and sends a security notice. Never yourself or the last active admin.

:::decision{title="A passkey still asks for the second factor"}
The passkey library does not require the device to verify the person, so enrolled people complete their code after a passkey, as after a password.
:::

:::gotcha{title="Agent tokens follow the browser that allowed them"}
An agent's token names the browser session that approved it. When that session ends, the agent must reconnect; a refused token says `invalid_grant`.
:::

:::gotcha{title="Changing the production hostname breaks passkeys"}
A passkey belongs to the hostname of `APP_URL`. Plan the change: people sign in another way and add a new passkey.
:::

## Reference

The flows in full, assurance and agent tokens, lockouts and limits, and the implementation and tests to review on an upgrade: [Account security reference](../reference/account-security.md).
