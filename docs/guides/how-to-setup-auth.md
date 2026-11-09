# How to set up authentication (Better Auth)

::reviewed{date="2026-11-09"}

People sign in with email and password and/or Google; users, sessions and accounts live in the app's own database, so there is no auth service to run. The same sign-in is the OAuth server agents connect through. Use this guide to set the secrets, choose sign-in methods or add Google. What people see: [Sign-in, passkeys and two-factor](../features/accounts.md).

::flow[Sign up -> Verify email -> Sign in -> Session]{title="Sign-in flow: sign up, verify the email if required, sign in, get a session"}

## Set it up

:::settings
- AUTH_EMAIL_PASSWORD = true (true | false) Email and password sign-up, sign-in and reset
- AUTH_REQUIRE_EMAIL_VERIFICATION = false (true | false) New accounts confirm their address first; needs email
  :::

At least one method must be on; the app refuses to start otherwise, naming the setting.

:::prompt{title="Paste this into your coding agent"}
```text
Use the setup-auth skill: set the secrets for <environment> and choose email and password
plus Google sign-in, with email verification on. Show me the dry run first.
```
:::

:::byhand
1. `bun run setup:secrets --env <env>` sets `BETTER_AUTH_SECRET` (32+ characters; an empty answer generates one) and, for Google, the client id and secret. Locally, drop `--env`.
2. `bun run setup:auth --env <env>` writes the sign-in choices into `apps/web/wrangler.jsonc`.
3. `bun run doctor`, then deploy.
   :::

:::gotcha{title="APP_URL must match the browser exactly"}
It is the only trusted origin, including the port locally. A mismatch signs people in and bounces them back to `/sign-in`.
:::

:::gotcha{title="Rotating BETTER_AUTH_SECRET signs everyone out"}
Keep one per environment and never share it between them.
:::

## Add Google

:::steps
1. **Create an OAuth client** of type "Web application" in Google Cloud Console.
2. **Add a redirect URI** per environment: `https://<your-domain>/api/auth/callback/google` (and `http://localhost:4321/api/auth/callback/google` locally).
3. **Store the id and secret** with `bun run setup:secrets` (and `--env <env>`). Both set turns the button on.
   :::

## Reference

What is wired up, the pages, who may sign up, auth mail, changing the auth tables after an upgrade, and what is not included: [Sign-in reference](../reference/auth.md).
