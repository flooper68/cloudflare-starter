# Email reference

::reviewed{date="2026-11-09"}

The detail behind [the guide](../guides/how-to-setup-email.md) on email: read it when the guide is not enough.

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

The script checks `wrangler email sending list <domain>` and runs `wrangler email sending enable` only when the domain is not onboarded yet (an already-enabled domain, including Wrangler's "Subdomain already exists [code 2040]", counts as done, so the script can be re-run for another environment or sender), prints the DNS records (SPF, DKIM, bounce), and writes into `apps/web/wrangler.jsonc` for that environment:

- `vars.EMAIL_FROM` (and `EMAIL_FROM_NAME` with `--name`)
- `send_email: [{ "name": "EMAIL", "allowed_sender_addresses": ["noreply@example.com"] }]`

Then deploy the environment (`cd apps/web && bun run deploy:production`) and send a test from `/app/email-demo`. Test with addresses you control; bounces from made-up addresses hurt the domain's reputation.

### Choosing The Sender

`EMAIL_FROM` is the address every mail of the environment comes from (password resets, verification, invitations, notifications), so pick it once per environment:

- Its domain must be onboarded to Email Service (DNS on Cloudflare, the SPF, DKIM and bounce records in place). It does not have to be the app's hostname: one onboarded domain can send for several projects.
- Give each project its own local part on a shared domain (the starter's production, served at `starter.flooper.me`, sends as `starter@flooper.me`), so a recipient sees which product wrote, and complaints and bounces can be told apart. The domain's reputation is still shared: a project that sends badly hurts the others.
- Use an address that exists or is routed (Email Routing), since replies go to it; no-reply addresses work, but users then answer into nothing.
- `setup:email` writes the same address into `allowed_sender_addresses`; the binding refuses any other sender.

## Email Verification

Once mail works in an environment, set `"AUTH_REQUIRE_EMAIL_VERIFICATION": "true"` in its `vars`. New users then get a verification link and cannot sign in until they open it; the link signs them in. The app refuses to start with the flag on and no email configured.

The screens around it (`CheckInboxCard` and `EmailVerifiedCard` in `packages/ui`, stories under Patterns/VerifyEmail):

| Screen                             | When                                                                                                                                                                        | What it does                                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Check your inbox (in `SignUpForm`) | sign-up with the flag on: there is no session yet                                                                                                                           | names the address; **Resend link** (`/send-verification-email`, limited by `auth.verification-email`, a 429 shows the wait); **Use another email** returns to the form |
| Check your inbox (in `SignInForm`) | a correct password for an unverified address (`EMAIL_NOT_VERIFIED`)                                                                                                         | the same card for the typed address                                                                                                                                    |
| `/verify-email`                    | signed in and not verified (the dashboard's checklist links here; with the flag off, sign-up signs in at once and the address stays unverified until the link is opened)    | resend to the user's own address; **Use another email** opens Settings › Account; a verified user is sent on to the app                                                |
| `/email-verified`                  | where every verification link lands (`callbackURL`, built by `verifiedCallbackURL` in `apps/web/src/lib/auth-links.ts`, keeping a same-site `?next=` such as an invitation) | **Email verified** and **Continue to the app**; Better Auth's `?error=` (expired or cut-off link) shows **This link doesn't work** with **Send a new link** (HTTP 400) |

Links are stateless and valid for an hour (Better Auth's default `emailVerification.expiresIn`); a resend does not invalidate the earlier ones.

## Swapping The Provider

Add an adapter in `packages/features/src/platform/adapters/<vendor>/` that implements `EmailService` and calls `assertEmailMessage` first, with a `<name>.contract.test.ts` running `describeEmailContract` ([overview.md](../architecture/overview.md#ports-and-adapters)). Return it from `buildEmailFeature` in [apps/web/src/lib/env.ts](../../apps/web/src/lib/env.ts), and keep its keys as Worker secrets. Pass `headers` through: notification mail needs `List-Unsubscribe`.

## Headers through the binding (unverified in production)

Notification mail sets `List-Unsubscribe` and `List-Unsubscribe-Post` through the binding's `headers` field ([how-to-send-notifications.md](notifications.md#email-headers-and-unsubscribe)). The local simulation and the tests accept them; whether Cloudflare Email Service delivers them unchanged has not been checked against a deployed environment yet. After the first deploy with email:

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
