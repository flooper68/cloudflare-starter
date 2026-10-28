# Evidence: platform-ports, auth links with email off in a deployed-like environment

Produced on 2026-10-28 from branch `platform-ports` with `astro dev` in `apps/web`, where `.dev.vars` was copied from `.dev.vars.example` and changed to `APP_ENV=production` and a blank `EMAIL_FROM`. That is how a deployed environment without email behaves. Captured with the Claude desktop browser pane (Chromium, 800x600; light theme via `prefers-color-scheme` emulation), signed out, and with curl.

| File | What it shows |
| --- | --- |
| `forgot-password-email-not-configured-dark.jpg`, `-light.jpg` | `/forgot-password` after submitting an address. The form shows the `EMAIL_NOT_CONFIGURED` message instead of "check your email" |
| `curl-email-not-configured.txt` | `POST /api/auth/request-password-reset` for an unknown address answers 412 `EMAIL_NOT_CONFIGURED`, the same as for a registered one (no account enumeration), with `traceparent` and `x-request-id`. The dev server output contains no reset link |
