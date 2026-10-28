# 0007. Cloudflare Email Service for outgoing mail

- Status: Accepted
- Date: 2026-10-28

## Context

The app sends transactional mail: password resets, email verification, and app notifications (the email demo). Using a separate email vendor adds an account, an API key per environment and another provider to monitor. Local development should not send real mail.

## Decision

We send mail through Cloudflare Email Service with the `EMAIL` `send_email` binding, declared in every environment. Callers use the provider-neutral `EmailService` interface; `createCloudflareEmailService` is the implementation. The sender is `EMAIL_FROM` (written per environment by `bun run setup:email`). Locally the binding is simulated and mail is logged. Without `EMAIL_FROM`, email is off and auth links go to the log.

## Consequences

Positive:

- One provider for everything: no API key, the binding is the permission.
- Local dev needs no setup and never sends real mail.
- The `EmailService` interface keeps the provider swappable without touching callers.

Negative:

- Email Service is in beta; limits and commands may change.
- Deployed sending needs Workers Paid and a sender domain onboarded on Cloudflare DNS.

## Alternatives considered

- **Mailjet (or another email API).** A second vendor, an API key as a secret in every environment, and no local simulation. Rejected.
