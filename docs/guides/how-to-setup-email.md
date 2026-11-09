# How to set up email (Cloudflare Email Service)

::reviewed{date="2026-11-09"}

The app sends mail through Cloudflare Email Service: password resets, verification, invitations and notifications. There is no API key (the binding is the permission), and locally every mail is simulated and saved to disk. Use this guide to send real mail from an environment or turn on email verification.

::flow[Use case -> Email port -> Cloudflare Email Service -> Inbox]{title="Mail flow: a use case sends through the email port, Cloudflare Email Service delivers it"}

## Locally

Nothing to set up. The dev server logs each mail and saves its text and HTML under `apps/web/.wrangler/tmp/email/`.

## Send real mail from an environment

:::settings
- EMAIL_FROM = none The sender address; blank turns email off
- EMAIL_FROM_NAME = none The sender's display name
  :::

You need the Workers Paid plan (3,000 mails a month included) and a sender domain whose DNS is on Cloudflare.

:::prompt{title="Paste this into your coding agent"}
```text
Use the setup-email skill to send email from production as noreply@<my domain>: onboard
the sender domain (dry run first), set EMAIL_FROM, deploy, and send a test mail to me.
```
:::

:::byhand
```bash
bun run setup:email --domain example.com --from noreply@example.com --env production --dry-run
bun run setup:email --domain example.com --from noreply@example.com --env production
```

It onboards the domain if needed and writes `EMAIL_FROM` and the `send_email` binding into `wrangler.jsonc`. Deploy, then send a test from `/app/email-demo`.
:::

:::gotcha{title="Test with addresses you control"}
Bounces from made-up addresses hurt the domain's reputation.
:::

## Turn on email verification

Once mail works, set `AUTH_REQUIRE_EMAIL_VERIFICATION` to `true` in the environment's `vars`. New people then get a link and cannot sign in until they open it; links are valid for an hour. The app refuses to start with verification on and no email.

:::decision{title="No email, no secrets in logs"}
Without a sender, a deployed environment refuses to send auth links (412 `EMAIL_NOT_CONFIGURED`) instead of logging them: a link is a credential. Only `APP_ENV=local` logs them.
:::

## Reference

What sends mail, choosing the sender, the verification screens, swapping the provider, headers through the binding and common problems: [Email reference](../reference/email.md).
