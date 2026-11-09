# Settings

::reviewed{date="2026-11-08"}

Every setting the app reads, in one place. Vars live in `apps/web/wrangler.jsonc` per environment (locally in `apps/web/.dev.vars`, which overrides them); secrets are set with `bun run setup:secrets --env <env>` and never committed. Local development takes its values from `apps/web/.dev.vars.example`. Deployed environments have no default for the required choices: the app refuses to start and names the missing setting, and `bun run doctor` checks every environment.

This page is generated from `apps/web/src/docs/reference/settings.ts`; a test fails when a setting is added to the app but not listed there. Run `bun run docs:reference` after changing it.

<!-- generated:settings -->

### Core

| Setting              | Kind   | Values                                      | What it does                                                                                                          |
| -------------------- | ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`            | var    | `local`, `develop`, `staging`, `production` | Which environment this is; `local` is the only one where auth links may be logged. [Docs](../start/deploy.md)         |
| `APP_URL`            | var    | text                                        | The app's public origin. Sign-in trusts only this origin; passkeys belong to its hostname. [Docs](../start/deploy.md) |
| `BETTER_AUTH_SECRET` | secret | text                                        | Signs sessions and tokens; at least 32 characters. [Docs](../guides/how-to-setup-auth.md)                             |

### Sign-in and security

| Setting                           | Kind   | Values                                               | What it does                                                                                                                      |
| --------------------------------- | ------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_EMAIL_PASSWORD`             | var    | `true`, `false`                                      | Email and password sign-in. At least one sign-in method must be on. [Docs](../guides/how-to-setup-auth.md)                        |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | var    | `true`, `false`                                      | New accounts confirm their address before they can sign in. [Docs](../guides/how-to-setup-email.md)                               |
| `GOOGLE_CLIENT_ID`                | secret | text                                                 | Google sign-in, with GOOGLE_CLIENT_SECRET; both set turns it on. [Docs](../guides/how-to-setup-auth.md)                           |
| `GOOGLE_CLIENT_SECRET`            | secret | text                                                 | Google sign-in's client secret. [Docs](../guides/how-to-setup-auth.md)                                                            |
| `TWO_FACTOR`                      | var    | `off`, `optional`, `required-for-admins`, `required` | Who must set up an authenticator app. [Docs](../guides/how-to-configure-account-security.md)                                      |
| `TWO_FACTOR_EMAIL_OTP`            | var    | `on`, `off`                                          | Emailed codes as a recovery option after an authenticator is set up. [Docs](../guides/how-to-configure-account-security.md)       |
| `TWO_FACTOR_TRUSTED_DEVICE_DAYS`  | var    | text                                                 | Days a browser may skip the code, 0 to 30; 0 turns remembered devices off. [Docs](../guides/how-to-configure-account-security.md) |
| `PASSKEYS`                        | var    | `on`, `off`                                          | Passkey sign-in. [Docs](../guides/how-to-configure-account-security.md)                                                           |
| `ADMIN_PORTAL`                    | var    | `on`, `off`                                          | The admin portal at /admin and the admin tools for agents. [Docs](../guides/how-to-use-admin-portal.md)                           |

### Workspaces and billing

| Setting                 | Kind | Values                        | What it does                                                                                                                                       |
| ----------------------- | ---- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WORKSPACE_MODE`        | var  | `personal`, `single`, `multi` | Everyone alone, one shared workspace, or many. No default when deployed. [Docs](../guides/how-to-configure-workspaces.md)                          |
| `SIGN_UP`               | var  | `open`, `invite`              | Anyone may sign up, or only people let in. No default when deployed. [Docs](../guides/how-to-configure-workspaces.md)                              |
| `SIGN_UP_DOMAINS`       | var  | text                          | With invite-only sign-up: email domains that may sign up without an invitation. [Docs](../guides/how-to-configure-workspaces.md)                   |
| `BOOTSTRAP_ADMIN_EMAIL` | var  | text                          | May always sign up; becomes a platform admin once verified and owns the workspace in single mode. [Docs](../guides/how-to-configure-workspaces.md) |
| `BILLING`               | var  | `off`, `manual`, `provider`   | Everything unlimited, plans an admin assigns, or a payment provider. [Docs](../guides/how-to-configure-plans-and-billing.md)                       |

### Email

| Setting           | Kind | Values | What it does                                                                       |
| ----------------- | ---- | ------ | ---------------------------------------------------------------------------------- |
| `EMAIL_FROM`      | var  | text   | The sender address; blank turns email off. [Docs](../guides/how-to-setup-email.md) |
| `EMAIL_FROM_NAME` | var  | text   | The sender's display name. [Docs](../guides/how-to-setup-email.md)                 |

### Files and privacy

| Setting                | Kind   | Values                    | What it does                                                                                                |
| ---------------------- | ------ | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `STORAGE_RECONCILE`    | var    | `off`, `report`, `delete` | The daily check for orphaned files: off, report them, or delete them. [Docs](../guides/how-to-use-trash.md) |
| `R2_ACCOUNT_ID`        | secret | text                      | Signed upload and download links: your Cloudflare account id. [Docs](../guides/how-to-setup-r2.md)          |
| `R2_ACCESS_KEY_ID`     | secret | text                      | Signed links: an access key limited to the files bucket. [Docs](../guides/how-to-setup-r2.md)               |
| `R2_SECRET_ACCESS_KEY` | secret | text                      | Signed links: the access key's secret. [Docs](../guides/how-to-setup-r2.md)                                 |
| `R2_FILES_BUCKET_NAME` | secret | text                      | Signed links: the files bucket's name. [Docs](../guides/how-to-setup-r2.md)                                 |

### Observability

| Setting               | Kind   | Values                     | What it does                                                                                                          |
| --------------------- | ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `LOG_SINK`            | var    | `workers-logs`, `none`     | Where logs go. [Docs](../guides/how-to-setup-logging.md)                                                              |
| `ERROR_REPORTER`      | var    | `workers-logs`, `none`     | Where error reports go. [Docs](../guides/how-to-setup-error-reporting.md)                                             |
| `METRICS`             | var    | `analytics-engine`, `none` | Latency and counts of requests, procedures, jobs and schedules. [Docs](../guides/how-to-setup-metrics-and-tracing.md) |
| `TRACING`             | var    | `workers`, `none`          | Traces across requests and jobs. [Docs](../guides/how-to-setup-metrics-and-tracing.md)                                |
| `ANALYTICS`           | var    | `analytics-engine`, `none` | Product events under pseudonymous ids. [Docs](../guides/how-to-setup-product-analytics.md)                            |
| `ANALYTICS_ID_SECRET` | secret | text                       | Key of the pseudonymous user and workspace ids; 32+ characters. [Docs](../guides/how-to-setup-product-analytics.md)   |
| `WEB_ANALYTICS`       | var    | `cloudflare`, `none`       | Cookieless page views. [Docs](../guides/how-to-setup-product-analytics.md)                                            |
| `WEB_ANALYTICS_TOKEN` | var    | text                       | The web analytics site token, with WEB_ANALYTICS=cloudflare. [Docs](../guides/how-to-setup-product-analytics.md)      |
| `FEATURE_FLAGS`       | var    | `d1`, `none`               | Flags stored in the database, or every flag at its catalog default. [Docs](../guides/how-to-use-feature-flags.md)     |

### Abuse protection and headers

| Setting                | Kind   | Values                   | What it does                                                                                                  |
| ---------------------- | ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `RATE_LIMITING`        | var    | `cloudflare`, `none`     | Rate limits on every action and sign-in. [Docs](../guides/how-to-configure-abuse-protection.md)               |
| `TURNSTILE`            | var    | `on`, `off`              | The bot check on sign-up, sign-in and password reset. [Docs](../guides/how-to-configure-abuse-protection.md)  |
| `TURNSTILE_SITE_KEY`   | var    | text                     | The bot check's public site key. [Docs](../guides/how-to-configure-abuse-protection.md)                       |
| `TURNSTILE_SECRET_KEY` | secret | text                     | The bot check's secret key. [Docs](../guides/how-to-configure-abuse-protection.md)                            |
| `CSP_MODE`             | var    | `enforce`, `report-only` | Enforce the content policy, or only report violations. [Docs](../guides/how-to-configure-security-headers.md) |

### Demo and QA

| Setting                 | Kind   | Values      | What it does                                                                                                      |
| ----------------------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `DEMO_MODE`             | var    | `off`, `on` | The starter's public demo; apps built from it keep off. [Docs](../guides/how-to-run-a-public-demo.md)             |
| `DEMO_RETENTION_DAYS`   | var    | text        | With the demo on: days before a demo account is erased, 2 to 365. [Docs](../guides/how-to-run-a-public-demo.md)   |
| `DEMO_SAMPLE_DATA`      | var    | `on`, `off` | With the demo on: new demo workspaces start with sample data. [Docs](../guides/how-to-run-a-public-demo.md)       |
| `DEMO_PROTECTED_EMAILS` | var    | text        | With the demo on: addresses the demo never erases, comma separated. [Docs](../guides/how-to-run-a-public-demo.md) |
| `QA_BYPASS`             | var    | `on`, `off` | Lets the automated QA suite skip the bot check, with QA_TOKEN. [Docs](../guides/how-to-qa-a-deployment.md)        |
| `QA_TOKEN`              | secret | text        | The QA suite's token; 32+ characters. [Docs](../guides/how-to-qa-a-deployment.md)                                 |
| `QA_EMAIL_DOMAIN`       | var    | text        | The email domain of QA accounts. [Docs](../guides/how-to-qa-a-deployment.md)                                      |

<!-- /generated:settings -->
