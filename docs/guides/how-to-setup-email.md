# How To Setup Email (Cloudflare Email Service)

The web Worker sends mail through [Cloudflare Email Service](https://developers.cloudflare.com/email-service/) with the `EMAIL` `send_email` binding. There is no API key: the binding is the permission. Callers use the Email port, `EmailService` in [packages/features/src/platform/ports/email.ts](../../packages/features/src/platform/ports/email.ts) (`enabled`, `send({ to, subject, text, html, headers? })`), so another provider is a new adapter, not a change to callers. Adapters: `cloudflare` (the binding), `noop` (email off) and `memory` (tests); each passes the port's contract suite, which also refuses header injection (a line break in a subject or header value) and headers the adapter sets itself (From, To, Subject).

What sends mail:

- `/app/email-demo` (tRPC `email.sendTest`, MCP tool `send_test_email`)
- Better Auth: password reset links and, when enabled, email verification
- Workspace invitations
- Notifications: one mail per notification or a daily digest, with RFC 8058 one-click unsubscribe headers ([how-to-send-notifications.md](how-to-send-notifications.md)); without email they stay in the in-app inbox

Email is on when the environment has the `EMAIL` binding and an `EMAIL_FROM` var: `buildPlatform` (`apps/web/src/server/platform.ts`) then gives `platform.email` the Cloudflare adapter, otherwise the noop one (`email.enabled` is false). Without them the demo reports "not configured". Auth links (password reset, verification) then go to the dev log only when `APP_ENV=local` (set in `.dev.vars`); a deployed environment never logs them and answers those requests with 412 `EMAIL_NOT_CONFIGURED` ("Email is not configured for this environment …").

## Local Development

Nothing to set up. `apps/web/.dev.vars.example` sets `EMAIL_FROM=noreply@example.test`, and `wrangler dev` simulates the binding: each message is logged by the dev server, with its text and HTML saved under `apps/web/.wrangler/tmp/email/`.

```
send_email binding called with MessageBuilder:
From: "Cloudflare Starter" <noreply@example.test>
To: "Test User" <test@example.test>
Subject: Verify your email
```

To send real mail from local dev, Cloudflare supports `"remote": true` on the binding. Use addresses you control.

## Deployed Environments

Requirements (Email Sending is in beta, check the docs for current terms):

- Workers Paid plan. It includes 3,000 mails a month, then $0.35 per 1,000.
- A sender domain whose DNS is on Cloudflare.

Set up a domain and an environment:

```bash
bun run setup:email --domain example.com --from noreply@example.com --env production --dry-run
bun run setup:email --domain example.com --from noreply@example.com --env production
```

The script runs `wrangler email sending enable`, prints the DNS records (SPF, DKIM, bounce), and writes into `apps/web/wrangler.jsonc` for that environment:

- `vars.EMAIL_FROM` (and `EMAIL_FROM_NAME` with `--name`)
- `send_email: [{ "name": "EMAIL", "allowed_sender_addresses": ["noreply@example.com"] }]`

Then deploy the environment (`cd apps/web && bun run deploy:production`) and send a test from `/app/email-demo`. Test with addresses you control; bounces from made-up addresses hurt the domain's reputation.

## Email Verification

Once mail works in an environment, set `"AUTH_REQUIRE_EMAIL_VERIFICATION": "true"` in its `vars`. New users then get a verification link and cannot sign in until they open it; the link signs them in. The app refuses to start with the flag on and no email configured.

## Swapping The Provider

Add an adapter in `packages/features/src/platform/adapters/<vendor>/` that implements `EmailService` and calls `assertEmailMessage` first, with a `<name>.contract.test.ts` running `describeEmailContract` ([overview.md](../architecture/overview.md#ports-and-adapters)). Return it from `buildEmailFeature` in [apps/web/src/lib/env.ts](../../apps/web/src/lib/env.ts), and keep its keys as Worker secrets. Pass `headers` through: notification mail needs `List-Unsubscribe`.

## Headers through the binding (unverified in production)

Notification mail sets `List-Unsubscribe` and `List-Unsubscribe-Post` through the binding's `headers` field ([how-to-send-notifications.md](how-to-send-notifications.md#email-headers-and-unsubscribe)). The local simulation and the tests accept them; whether Cloudflare Email Service delivers them unchanged has not been checked against a deployed environment yet. After the first deploy with email:

1. Trigger a notification mail to an address you control (invite yourself into a workspace from a second account and accept, so the first account gets "… joined …").
2. Open the received mail's original source (Gmail: "Show original") and check that both headers are present, `List-Unsubscribe` holding `<https://<your app>/api/notifications/unsubscribe?t=…>`, and that DKIM passes.
3. Gmail and Apple Mail then show an "Unsubscribe" link next to the sender; using it should turn that type's email off under `/app/notifications/preferences`.

If the headers are missing, the binding drops custom headers: report it, and until then the footer link in every mail is the way to unsubscribe.

## Common Problems

| Symptom                     | Fix                                                                              |
| --------------------------- | -------------------------------------------------------------------------------- |
| "Email is not configured"   | The environment has no `EMAIL_FROM` var or no `send_email` binding               |
| Send rejected               | The sender is not on an onboarded domain or not in `allowed_sender_addresses`    |
| Mail lands in spam          | Check the records from `bunx wrangler email sending dns get <domain>`; add DMARC |
| Reset link only in the logs | Email is off for that environment; see above                                     |
