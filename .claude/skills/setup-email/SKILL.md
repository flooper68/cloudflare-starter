---

name: setup-email
description: Set up or troubleshoot outgoing email for this starter with Cloudflare Email Service (send_email binding) — onboarding the sender domain, DNS records, EMAIL_FROM per environment, local simulation, and auth mails (password reset, verification). Use when the user asks to send email, set up the email demo, or enable email verification.
---

# Email (Cloudflare Email Service)

The web Worker sends mail through the `EMAIL` `send_email` binding, wrapped by the Email port's Cloudflare adapter (`createCloudflareEmail` in `packages/features/src/platform/adapters/cloudflare/cloudflare-email.ts`). Callers use the `EmailService` port (`platform/ports/email.ts`) only. Full guide: `docs/guides/how-to-setup-email.md`.

Cloudflare docs change; check https://developers.cloudflare.com/email-service/ before relying on limits or commands.

## Local

Works out of the box: the binding is simulated by `wrangler dev`. `EMAIL_FROM` in `.dev.vars` (default `noreply@example.test`) turns it on; the dev log prints each message and where its text/HTML was saved. Blank `EMAIL_FROM` turns email off: auth links go to the dev log with `APP_ENV=local` only; deployed without email, reset and verification requests fail with 412 `EMAIL_NOT_CONFIGURED`.

## Deployed

Facts to tell the user before starting: Email Sending is in beta, needs Workers Paid (3,000 mails/month included), and the sender domain's DNS must be on Cloudflare.

1. Ask for the sender domain and address (e.g. `noreply@example.com`). Do not guess.
2. Preview: `bun run setup:email --domain <domain> --from <address> --env <env> --dry-run`.
3. Run it without `--dry-run` after the user confirms. It enables sending, prints the DNS records, and writes `EMAIL_FROM` and `allowed_sender_addresses` into `wrangler.jsonc`.
4. Deploy: `cd apps/web && bun run deploy:<env>` (or `bun run deploy` for develop).
5. Test from `/app/email-demo` with an address the user controls. Do not send to made-up addresses: bounces hurt the domain's reputation.

Optional: `AUTH_REQUIRE_EMAIL_VERIFICATION=true` in the environment's vars once mail is confirmed working.

## Troubleshooting

- "Email is not configured" in the demo: the environment has no `EMAIL_FROM` var or no `send_email` binding.
- Send rejected: the sender is not on an onboarded domain, or not in `allowed_sender_addresses`.
- Mail in spam: check SPF/DKIM/DMARC records from `bunx wrangler email sending dns get <domain>`.

Email changes from Settings use Better Auth confirmation/verification mail. `/change-email` joins the deployed-without-email 412 guard; local development logs links only under `APP_ENV=local`.
