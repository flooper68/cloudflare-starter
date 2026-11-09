# Abuse protection reference

::reviewed{date="2026-11-09"}

The detail behind [the guide](../guides/how-to-configure-abuse-protection.md) on rate limits and the human check: read it when the guide is not enough.

## What Is Wired Up

| Where                                                                                                                                  | Policy (catalog id)                                                                                                                                                                                                                                                                    | Enforced by                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every `/api/auth/*` request                                                                                                            | `auth.ip` (per IP)                                                                                                                                                                                                                                                                     | `RL_AUTH_IP` binding, before Better Auth                                                                                                                                                                                               |
| `/sign-in/*`, `/sign-up/*`, `/request-password-reset`                                                                                  | `auth.sign-in`, `auth.sign-up`, `auth.password-reset`                                                                                                                                                                                                                                  | Better Auth's limiter (counters in D1)                                                                                                                                                                                                 |
| `/two-factor/*`, `/two-factor/send-otp`, `/passkey/*`                                                                                  | `auth.two-factor` (10 a minute), `auth.otp-send` (3 a minute), `auth.passkey` (20 a minute)                                                                                                                                                                                            | Better Auth's limiter ([account security](../guides/how-to-configure-account-security.md)); failed factor verifications also lock the account's verification for 15 minutes after ten                                                  |
| `/change-email`, `/delete-user`                                                                                                        | `auth.change-email` (3 a minute), `auth.delete-user` (3 an hour)                                                                                                                                                                                                                       | Better Auth's limiter                                                                                                                                                                                                                  |
| `/oauth2/register`, `/oauth2/token`, `/oauth2/authorize`                                                                               | `auth.oauth-*`                                                                                                                                                                                                                                                                         | Better Auth's limiter                                                                                                                                                                                                                  |
| `/send-verification-email` (anonymous, mails any address)                                                                              | `auth.verification-email` (3 a minute per IP)                                                                                                                                                                                                                                          | Better Auth's limiter. No human check: the check-inbox screens only resend to the address just signed up or signed in with (both behind the human check) or the signed-in user's own; the tight limit and `auth.ip` bound direct calls |
| Every tRPC mutation (web and MCP tool calls)                                                                                           | `mutation.user` unless `PROCEDURE_POLICIES` says otherwise                                                                                                                                                                                                                             | `RL_MUTATION`, tRPC middleware (`init.ts`)                                                                                                                                                                                             |
| `storage.createUpload`, `POST /api/files`, `POST /api/account/avatar`, `POST /api/workspaces/[workspaceId]/logo`                       | `upload.user`                                                                                                                                                                                                                                                                          | `RL_UPLOAD`                                                                                                                                                                                                                            |
| `/mcp`                                                                                                                                 | `mcp.ip` (600/min, MCP clients share server IPs) before the token is verified, `mcp.user` after                                                                                                                                                                                        | `RL_MCP_IP`, `RL_MCP_USER`                                                                                                                                                                                                             |
| `workspace.invitations.create` (mails a link)                                                                                          | `invitation.send`                                                                                                                                                                                                                                                                      | `RL_INVITE`                                                                                                                                                                                                                            |
| `/invite/[token]` (looks up an invitation token from the URL)                                                                          | `token.lookup` (30 a minute per IP)                                                                                                                                                                                                                                                    | `RL_TOKEN_LOOKUP`, in the page before the lookup                                                                                                                                                                                       |
| `/unsubscribe` (checks a mail's unsubscribe token)                                                                                     | `token.lookup`                                                                                                                                                                                                                                                                         | `RL_TOKEN_LOOKUP`, in the page before the check                                                                                                                                                                                        |
| `POST /api/notifications/unsubscribe` (RFC 8058 one-click)                                                                             | `notifications.unsubscribe` (20 a minute per IP; anonymous, the signed token authorizes)                                                                                                                                                                                               | `RL_UNSUBSCRIBE`, in the route before the token is checked                                                                                                                                                                             |
| `POST /api/billing/webhook` (payment provider events)                                                                                  | `billing.webhook` (300 a minute per IP: providers send from a few shared IPs)                                                                                                                                                                                                          | `RL_BILLING_WEBHOOK`, in the route before the signature check                                                                                                                                                                          |
| `analytics.track` (client analytics batches)                                                                                           | `analytics.client` (120 a minute per user), not `mutation.user`                                                                                                                                                                                                                        | `RL_ANALYTICS`                                                                                                                                                                                                                         |
| `admin.email.sendTest` (an admin mails the test email to a typed-in address)                                                           | `invitation.send`, not `mutation.user`                                                                                                                                                                                                                                                 | `RL_INVITE`                                                                                                                                                                                                                            |
| `/health`, `/health/live`, `/health/ready` (public, for uptime monitors)                                                               | `health.ip` (120 a minute per IP, all three together; readiness calls D1 and R2)                                                                                                                                                                                                       | `RL_HEALTH`, before any check runs ([how-to-monitor-health.md](../guides/how-to-monitor-health.md))                                                                                                                                    |
| `containerRuns.start` (the container workflow demo: each run starts a billed container)                                                | `container.run` (3 a minute per user), not `mutation.user`; the use case adds 5 runs an hour per user and the `CONTAINER_DEMO_DAILY_CAP` for the deployment, counted in D1 ([how-to-run-container-workflows.md](../guides/how-to-run-container-workflows.md#limits-and-cost-controls)) | `RL_CONTAINER_RUN`                                                                                                                                                                                                                     |
| `/api/csp-report` (browsers' Content-Security-Policy violation reports)                                                                | `csp.report` (30 a minute per IP)                                                                                                                                                                                                                                                      | `RL_CSP_REPORT`, before the report is read ([how-to-configure-security-headers.md](security-headers.md#violation-reports))                                                                                                             |
| Sign-up, sign-in, password reset (email + password)                                                                                    | Turnstile human check                                                                                                                                                                                                                                                                  | Better Auth `hooks.before` → `HumanVerifier`                                                                                                                                                                                           |
| The same three endpoints, and `/api/qa/outbox` and `/api/qa/cleanup`, with `X-QA-Token`, while `QA_BYPASS=on` (the automated QA suite) | `qa.bypass` (30 a minute per IP, counted before the token is compared); the Turnstile check is skipped only for the right token and an address `qa+…@QA_EMAIL_DOMAIN`                                                                                                                  | `RL_QA_BYPASS`, in `hooks.before` before Turnstile ([QA bypass](#qa-bypass))                                                                                                                                                           |
| Password reset link an admin sends (in-process `auth.api` call, no HTTP request)                                                       | none: no visitor to check; `adminProcedure` authorized the admin. Only `/request-password-reset`, and only without an incoming request (`isInProcessCall` in server/auth.ts)                                                                                                           | `apps/web/test/api/admin.test.ts` proves HTTP requests without a token are still refused                                                                                                                                               |

The numbers live in one place: `RATE_LIMIT_POLICIES` in [packages/features/src/abuse/domain/policies.ts](../../packages/features/src/abuse/domain/policies.ts). User-scoped policies count a signed-in user by id and an anonymous caller by IP (`CF-Connecting-IP`).

What the caller sees:

- **Headers** ([draft-ietf-httpapi-ratelimit-headers-11](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), Structured Field Lists): a limited request that is allowed names its quotas, `RateLimit-Policy: "auth.ip";q=60;w=60, "auth.sign-in";q=10;w=60`. A refused one adds `Retry-After: <seconds>` and `RateLimit: "<policy>";r=0;t=<seconds>`. Workers Rate Limiting does not say how much quota is left, so `RateLimit` is sent only on refusals. Sent by `/api/auth/*`, `POST /api/files`, the avatar and workspace-logo uploads, `/mcp` and tRPC mutations.
- **tRPC:** `TOO_MANY_REQUESTS` (HTTP 429).
- **MCP tools:** a tool error `{ code: "TOO_MANY_REQUESTS", httpStatus: 429, retryAfterSeconds }`; `/mcp` itself answers a JSON-RPC error (`data.retryAfterSeconds`) with HTTP 429.
- **Other HTTP routes** (`/api/auth/*`, `/api/files`, the avatar and logo uploads): [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details, `application/problem+json`, built by `problemResponse` (`apps/web/src/server/http.ts`) in `apps/web/src/server/rate-limited-response.ts`, with `reference` (the trace id users quote, also `x-request-id`) and `code` (`RATE_LIMITED`, `HUMAN_CHECK_FAILED`, `HUMAN_CHECK_UNAVAILABLE`: the `DomainError` codes) as extension members. Better Auth's own 429s are converted too. Example:

  ```json
  {
    "type": "https://iana.org/assignments/http-problem-types#quota-exceeded",
    "title": "Too Many Requests",
    "status": 429,
    "detail": "Too many requests. Try again in 60 seconds.",
    "instance": "/api/files",
    "code": "RATE_LIMITED",
    "violated-policies": ["upload.user"],
    "retryAfterSeconds": 60,
    "reference": "4bf92f3577b34da6a3ce929d0e0e4736"
  }
  ```

- **Forms:** sign-up, sign-in and forgot-password show `RateLimitNotice` with a countdown, and `HumanCheck` (the Turnstile widget) with submit disabled until it passes.
- **Human check:** refusals are Problem Details with `code` as an extension member (Better Auth's client reads `code` and `detail`). Both fail closed, and each refusal of a request that named an email is recorded in the audit log as `auth.human_check_failed` (`form`, `reason`; [how-to-use-the-audit-log.md](../guides/how-to-use-the-audit-log.md)).

Problem types (the `type` URIs point at these sections; a project that publishes its own docs changes `DOCS` in `rate-limited-response.ts`):

### Quota exceeded

`https://iana.org/assignments/http-problem-types#quota-exceeded`, status 429: a rate-limit policy refused the request. `violated-policies` names it, `retryAfterSeconds` says how long to wait (also in `Retry-After`). The type is the one draft-ietf-httpapi-ratelimit-headers proposes to register.

### Human check failed

Status 400, `code: "HUMAN_CHECK_FAILED"`: no Turnstile token, or Siteverify rejected it (invalid, expired, reused, issued for another form). The visitor solves the widget again; the forms reset it after every attempt.

### Human check unavailable

Status 503, `code: "HUMAN_CHECK_UNAVAILABLE"`: Siteverify did not answer (5 s per attempt, one retry with the same idempotency key, so about 10 s at most) or rejected the secret key. The request is refused; the visitor tries again later. Each occurrence is also sent to the ErrorReporter with the request context and the reason (`ERROR_REPORTER`, [how-to-setup-error-reporting.md](../guides/how-to-setup-error-reporting.md)): the provider failing is ours to fix.

## Settings

Required in every environment, no defaults; a missing or wrong value fails the first request with an error naming the setting.

| Name                   | Kind                                | Values                                                                                                   |
| ---------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `RATE_LIMITING`        | var (`wrangler.jsonc`, `.dev.vars`) | `cloudflare` (the bindings below) or `none` (nothing is limited, Better Auth's limits stay)              |
| `TURNSTILE`            | var                                 | `on` or `off`                                                                                            |
| `TURNSTILE_SITE_KEY`   | var (public)                        | the widget's site key; required with `on`                                                                |
| `TURNSTILE_SECRET_KEY` | secret (`.dev.vars`, Worker secret) | the widget's secret key; required with `on`                                                              |
| `QA_BYPASS`            | var                                 | `on` or `off`: the [QA bypass](#qa-bypass); `on` in production and develop, `off` in staging and locally |
| `QA_EMAIL_DOMAIN`      | var                                 | the only mail domain the bypass covers (`qa.flooper.me`), a lowercase hostname; required with `on`       |
| `QA_TOKEN`             | secret (Worker secret)              | the token the QA suite sends in `X-QA-Token`, 32+ characters; required with `on`                         |

Bindings, in the top level, `env.staging` and `env.production` of `apps/web/wrangler.jsonc`: `RL_AUTH_IP`, `RL_MUTATION`, `RL_MCP_IP`, `RL_MCP_USER`, `RL_UPLOAD`, `RL_INVITE`, `RL_TOKEN_LOOKUP`, `RL_BILLING_WEBHOOK`, `RL_ANALYTICS`, `RL_UNSUBSCRIBE`, `RL_HEALTH`, `RL_CSP_REPORT`, `RL_QA_BYPASS`, `RL_CONTAINER_RUN` (`ratelimits`). Their `limit` and `period` must equal the catalog's; `test/architecture/abuse.test.ts` checks it. `namespace_id` is a positive integer unique in the whole Cloudflare account; there is no resource to create. See [Namespace ids](#namespace-ids).

### Namespace Ids

A `namespace_id` is account-wide, not per Worker: every binding with the same id, in any Worker of the account, counts against the same counters. Two projects that both ship `9001` lock each other's users out. Each project, and each environment in it, needs its own block.

- The starter's own Worker (`cloudflare-starter-web`) uses 7001–7014 (develop), 8001–8014 (staging) and 9001–9014 (production); a new binding takes the next number in each block (`RL_CONTAINER_RUN` is 7014, 8014, 9014). Earlier versions shipped 1001–1010, 2001–2010 and 3001–3010.
- A project built from the starter picks its block when it renames the Worker: `bun run setup:cloudflare --env all --dry-run` shows the plan, and the same command without `--dry-run` writes it. While an environment still has the starter's ids (current or earlier) and the Worker has another name, or an id is missing or used twice in `wrangler.jsonc`, the script replaces them with ids from a block derived from a hash of the Worker's `name`: one of 900,000 blocks of 1000 ids between 100,000,000 and 999,999,999, with develop at `+1…`, staging at `+101…` and production at `+201…`. Ids that are already the project's own are kept.
- `--namespace-base <n>` uses the block starting at `n` instead (for example one you keep track of for the account), for the environments passed with `--env`.
- Residual risk: Cloudflare has no API or Wrangler command that lists the namespace ids in use, so neither the script nor `bun run doctor` can see other Workers. Two Worker names whose hashes fall into the same block, or a hand-picked id another Worker also uses, still collide. If you run several projects in one account, keep a list of their blocks (or use `--namespace-base` from it). Changing an id resets that limit's counters, which is harmless.

`bun run doctor` prints the ids each environment uses, warns that they must be unique across the account, and fails while a renamed project still has the starter's ids; `test/architecture/abuse.test.ts` checks the same and that every id in the file is unique.

## Local Development

The top-level `vars` of `apps/web/wrangler.jsonc`, which local dev uses too, set `RATE_LIMITING=cloudflare`, `TURNSTILE=on` and Cloudflare's always-pass test site key; `apps/web/.dev.vars.example` sets the matching test secret `TURNSTILE_SECRET_KEY` and shows how to override the two settings (commented lines). Cloudflare's test keys:

| Key                                          | Behaviour                                           |
| -------------------------------------------- | --------------------------------------------------- |
| site key `1x00000000000000000000AA`          | visible widget, always passes                       |
| site key `2x00000000000000000000AB`          | visible widget, always fails                        |
| secret `1x0000000000000000000000000000000AA` | accepts only the test token `XXXX.DUMMY.TOKEN.XXXX` |
| secret `2x0000000000000000000000000000000AA` | always rejects                                      |

The rate-limit bindings are simulated by Miniflare (windows aligned to the clock). Locally nothing sets `CF-Connecting-IP`, so every local request shares one IP counter; send the header yourself to test per-IP limits, as `apps/web/test/e2e/abuse.spec.ts` does. Ordinary local development loads Cloudflare's widget and calls Siteverify, so sign-up needs network access. Automated E2E runs instead simulate the published test keys locally, with Turnstile enabled and all widget, verification and rate-limit assertions intact; see [the test-only transport](../architecture/testing.md#e2e-tests). This simulation cannot be used in a production build.

Try it:

```bash
# 429 (Problem Details, Retry-After, RateLimit) after 60 requests a minute from one IP (auth.ip)
for i in $(seq 1 62); do
  curl -s -o /dev/null -w "%{http_code} %header{retry-after}\n" \
    -H "cf-connecting-ip: 203.0.113.9" http://localhost:4321/api/auth/get-session
done | sort | uniq -c
```

## Deployed Environments

1. Per environment, create a Turnstile widget: Cloudflare dashboard > Turnstile > Add widget, mode **Managed**, hostname the environment's domain (not localhost). `bun run setup:cloudflare --env <env>` prints these steps; it does not call the Turnstile API.
2. Put the site key in `TURNSTILE_SITE_KEY` of that environment's `vars` in `apps/web/wrangler.jsonc` (the top level is develop). The starter ships the always-pass test key there; `bun run doctor` warns while staging or production still has it (for production: do not deploy with it).
3. `bun run setup:secrets --env <env>` and enter `TURNSTILE_SECRET_KEY`. Setting a secret deploys a new version.
4. Keep `RATE_LIMITING=cloudflare`. Workers Rate Limiting needs Wrangler 4.36 or later (the repository pins a newer one).

`bun run doctor` checks the settings locally and in every environment, the `namespace_id`s for duplicates and leftover starter ids ([Namespace ids](#namespace-ids)), and reminds you of the secret.

## QA Bypass

> **Starter-only, removed by `starter:strip`** (`qa-automation`): the starter runs `QA_BYPASS=on` for its own QA suite. The strip sets it `off` in every environment and removes `QA_EMAIL_DOMAIN`; the code below stays, inert ([how-to-start-a-project.md](../guides/how-to-start-a-project.md)).

The automated QA suite ([how-to-qa-a-deployment.md](../guides/how-to-qa-a-deployment.md)) signs up, signs in and resets passwords on production with no human, so it cannot solve Turnstile. With `QA_BYPASS=on` a request may skip the Turnstile check, and only that check, when all of this holds:

- it goes to one of the human-checked endpoints (`HUMAN_CHECKED_PATHS` in `apps/web/src/server/auth.ts`): `/api/auth/sign-up/email`, `/api/auth/sign-in/email` and `/api/auth/request-password-reset` (the forgot-password form). Nothing else reads the header;
- it carries `X-QA-Token` equal to the `QA_TOKEN` secret, compared in constant time (`timingSafeEqual` in `packages/features/src/abuse/domain/`);
- the email in its body is a QA address: `qa@` or a subaddress `qa+<tag>@` directly in `QA_EMAIL_DOMAIN` (`qa+20261108kqzt-owner@qa.flooper.me`), at most 254 characters; not another mailbox of the domain, not a subdomain, not the domain in the local part;
- the IP has not sent more than 30 such requests in the minute (`qa.bypass`, `RL_QA_BYPASS`): every request with the header is counted before the token is compared, so guessing it is slow, and over the limit the request is refused with 429 (`violated-policies: ["qa.bypass"]`).

Then the request goes on without Turnstile and `qa.bypass.used` is recorded in the audit log (target the email, `metadata.form`; never the token). Everything after the human check still runs: Better Auth's per-path limits (5 sign-ups a minute per IP and so on), `auth.ip`, the sign-up policy, email verification, second factors. A wrong token or a non-QA address logs the warning `qa.bypass.rejected` (`app.qa_bypass.reason`: `wrong_token` or `wrong_domain`, no token) and falls back to the normal Turnstile check, which then refuses the request unless it has a valid widget token. With `QA_BYPASS=off` the header is ignored entirely: not counted, not compared, not logged. Turnstile still guards everyone else.

**QA addresses belong to the QA suite.** With `QA_BYPASS=on`, a sign-up (`/sign-up/email`) or an email change (`/change-email`) to a QA address is refused with 403 `QA_ADDRESS_RESERVED` unless it carries the QA token (`refuseQaAddressWithoutToken`, server/qa-admin.ts), even with a valid Turnstile token. Mail to QA addresses is not sent but kept in the app's QA outbox ([how-to-qa-a-deployment.md](../../apps/web/test/qa/README.md#the-qa-outbox)), which only the token reads. So nobody without the token can create, claim or verify a QA account.

**The token's other endpoints.** `/api/qa/outbox` (read and clear the outbox) and `/api/qa/cleanup` (erase run accounts) use the same token and the same `qa.bypass` limit, counted before the token is compared, and answer 404 with `QA_BYPASS=off` (server/qa-endpoint.ts). The outbox serves only run addresses (`qa+<runId>-<role>@`) and the QA admin's; the cleanup erases only run accounts.

What the token can do if it leaks: everything the QA suite does, without a human check, at the rate the per-IP limits allow. That is: create, sign in to, reset and erase accounts at `qa+…@qa.flooper.me`, read their mail in the outbox, and **act as a platform admin on production** through the [QA admin](#the-qa-admin), whose password is derived from the token. It never signs in as, reads mail of, or erases any other address, but as a platform admin it can do what the admin portal does to anyone (every admin action is audited as usual, with the QA admin as actor).

To contain a leak, in this order: (1) set `QA_BYPASS` to `off` and deploy. That takes effect at once: the bypass, the outbox and the cleanup are gone, QA mail goes out (to a domain without mail servers), and the QA admin is no admin from the next request. (2) While the bypass is still off, erase the QA admin in the admin portal (`/admin/users`, `qa+admin@…`, Delete account): that ends its sessions too. (3) Review the audit log for its actions (`/admin/audit`, actor `qa+admin@…`). (4) Put a new `QA_TOKEN` with `bun run setup:secrets --env production` and in the GitHub secret. (5) Switch the bypass back on; the next QA run creates a new QA admin with a password from the new token. The suite's CI scrubs the token and the QA passwords from its uploaded report, since Playwright traces record request headers and typed text. Workers Logs may record request headers of invocations; they are visible to members of the Cloudflare account only.

Settings: `QA_BYPASS` is required in every environment without a default, like the others; `QA_EMAIL_DOMAIN` and the `QA_TOKEN` secret are required with `on` and ignored with `off`. A missing or invalid one fails the settings check of `/health/ready` and every request, naming the setting; `bun run doctor` checks them per environment. Decided per environment in `apps/web/wrangler.jsonc` (with a comment): production `on` (the suite runs after every production deploy), develop `on` (to run it against a develop deploy first), staging `off`; local dev sets `off` in `.dev.vars`.

Turn it on for an environment:

1. `QA_BYPASS: "on"` and `QA_EMAIL_DOMAIN` in that environment's vars.
2. `openssl rand -hex 32`, then `bun run setup:secrets --env <env>` and enter it as `QA_TOKEN`; store the same value as the `QA_TOKEN` secret of the GitHub environment `qa` ([how-to-qa-a-deployment.md](../../apps/web/test/qa/README.md#ci)).
3. Deploy.

## The QA Admin

The QA suite needs a platform admin (the admin journeys, the weekly delivery check) and gets one with nothing from the owner: `qa+admin@<QA_EMAIL_DOMAIN>` (`qa+admin@qa.flooper.me`), a constant.

- **Provisioned by the suite.** Its global setup signs it up through the bypass when it does not exist, opens the verification link from the QA outbox and signs in. Its password, like every QA account's, is HMAC-SHA256(QA_TOKEN, address): never stored, never a secret of its own.
- **Promoted by the app**, the same way as `BOOTSTRAP_ADMIN_EMAIL` (`promoteBootstrapAdmin`): with `QA_BYPASS=on`, exactly that address becomes a platform admin once its address is verified (at verification, and at each sign-in if it is not one yet), recorded as `qa.admin.promoted` with the system as actor. Safe because only token holders can create the account (QA addresses are reserved for sign-up, email change and every other sign-in method; no social account is ever linked to one) and read its verification mail (the outbox); a `qa+admin@` of any other domain is an ordinary account.
- **Short admin power.** It is an admin only in a browser session signed in at most an hour ago, never over MCP (`QA_ADMIN_SESSION_MS`, checked by `findAdminAccess` on every admin request), and its sessions are created an hour long.
- **Off means off.** With `QA_BYPASS=off`, or for a `qa+admin@` of an earlier `QA_EMAIL_DOMAIN`, the account is no admin whatever its stored role (`findAdminAccess` refuses it on every request) and is demoted, with its sessions revoked, at its next sign-in (`qa.admin.demoted`). It is never promoted while the bypass is off, and never counts as the other admin that lets the last real admin step down or delete their account.
- **Audited like every admin.** Its admin actions are recorded with it as actor, as anyone's.

The trade-off, accepted by the owner: whoever holds `QA_TOKEN` can act as a platform admin on production. Keep the token where the production Worker secrets are (the Worker secret, and the GitHub environment `qa` restricted to `main`), and contain a leak as above.

## Limits Of The Edge Limiter

Workers Rate Limiting counts per Cloudflare location and is eventually consistent: a burst can pass a little more than the limit, and an attacker spread over many locations gets the limit in each. Periods are only 10 or 60 seconds. That suits cheap, broad limits. For exact, global limits (money, invitations to a whole domain) use a Durable Object limiter (below). Many people behind one IP (an office NAT, Claude's servers for MCP) share the IP-scoped counters: `mcp.ip` is 600 a minute for that reason, and per-user limits apply once the token is known. Raise `auth.ip` or `mcp.ip` if real users hit them.

## Change A Limit

1. Edit the policy in `RATE_LIMIT_POLICIES`.
2. For an edge policy, set the same `limit` and `period` on its binding in all three environments of `wrangler.jsonc`. Better Auth policies need nothing else: `customRules` are generated from the catalog.
3. `bun run test` (domain, architecture and API tests read the catalog).

## Give A Mutation Or Route A Policy

Every tRPC mutation is limited by `mutation.user` automatically. A tighter limit (anything that sends mail, invites, or costs money): add an edge policy with its own binding, then `PROCEDURE_POLICIES["<router>.<procedure>"] = "<policy id>"`. An endpoint under `apps/web/src/pages`: call `refuseOverLimit(buildPlatform(env), "<policy id>", { userId, ip: locals.requestContext.ip }, (error) => rateLimitedResponse(error, locals.requestContext, url.pathname))` before doing work, and list the file in `ROUTE_POLICIES`. The same holds for an `.astro` page that reads a token from the URL on the server (`Astro.params`, a `token` query parameter): `/invite/[token]` applies `token.lookup` in its frontmatter; the architecture test finds such pages. Not limiting something is a decision: add it to `RATE_LIMIT_EXEMPT` with the reason. `test/architecture/abuse.test.ts` fails until one of these is done.

A new binding: add it to the `ratelimits` of all three environments with a new `namespace_id` each, to `AppEnv` in `apps/web/src/server/env.ts`, and the architecture test and `buildPlatform` pick it up from the catalog.

## Another Limiter Or Verifier

The limiter and the human check are ports in `packages/features/src/platform/ports/` (`RateLimiter`, `HumanVerifier`), each with a contract suite (`rate-limiter.contract.ts`, `human-verifier.contract.ts`). Adapters live in `platform/adapters/<vendor>/`.

- **Durable Object strict limiter.** Write a Durable Object that keeps a counter per key (a fixed or sliding window in its storage) and an adapter `adapters/cloudflare/durable-object-rate-limiter.ts` implementing `RateLimiter` with the namespace binding as its dependency. Run `describeRateLimiterContract` against it in a `*.contract.integration.test.ts` (workerd). Declare the class and binding in all environments (plus a migration tag) and select it in `buildPlatform` (`apps/web/src/server/platform.ts`) for the policies that need exactness, for example with a new `enforcer` value in the catalog.
- **Another CAPTCHA vendor** (hCaptcha, reCAPTCHA): an adapter implementing `HumanVerifier` with an injected `fetch`, its contract test, a new `TURNSTILE` value in `parseAbuseConfig` (`config.ts`) and `buildPlatform`, and a widget component next to `HumanCheck` in `packages/ui`. The server hook and the forms stay as they are; the header is `x-captcha-response`.

## Tests

| Layer       | Where                                                                                                                                                                                                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain      | `packages/features/src/abuse/domain/*.test.ts` (catalog validity, keys, Better Auth rules, QA addresses, constant-time comparison); `packages/features/src/abuse/check-qa-bypass.test.ts`                                                                                                                                                     |
| Integration | `packages/features/src/platform/adapters/**/*.contract*.test.ts` (each adapter against its port contract; the cloudflare limiter on Miniflare's binding)                                                                                                                                                                                      |
| API         | `apps/web/test/api/abuse.test.ts` (429 with Retry-After, RateLimit fields and Problem Details on a mutation, uploads, `/api/auth/*`, `/mcp`; Turnstile with Siteverify answered by `test/outbound.ts`, no network); `apps/web/test/api/qa-bypass.test.ts` (the QA bypass: off, wrong token, wrong domain, accepted and audited, rate limited) |
| Component   | `packages/ui/src/components/human-check.stories.tsx`, `rate-limit-notice.stories.tsx`                                                                                                                                                                                                                                                         |
| E2E         | `apps/web/test/e2e/abuse.spec.ts`                                                                                                                                                                                                                                                                                                             |
| Static      | `test/architecture/abuse.test.ts` (coverage, bindings per environment)                                                                                                                                                                                                                                                                        |

## Troubleshooting

| Symptom                                                                                      | Cause and fix                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Set RATE_LIMITING to cloudflare or none`, `Set TURNSTILE to on or off`                      | The setting is missing in that environment's vars or `.dev.vars`.                                                                              |
| `TURNSTILE=on needs the TURNSTILE_SECRET_KEY secret`                                         | `bun run setup:secrets --env <env>`, or copy it from `.dev.vars.example` locally.                                                              |
| `RATE_LIMITING=cloudflare needs the RL_… ratelimits binding`                                 | The binding is missing in that environment of `wrangler.jsonc`.                                                                                |
| Every sign-up fails with "The human check did not pass"                                      | Site key and secret key belong to different widgets, or a test site key is paired with a real secret.                                          |
| An error report "Siteverify rejected the secret key" (attribute `app.auth.human_check.form`) | `TURNSTILE_SECRET_KEY` is wrong for this widget.                                                                                               |
| Everyone shares one limit                                                                    | Requests arrive without `CF-Connecting-IP` (local dev, or a proxy in front of the Worker).                                                     |
| `QA_BYPASS=on needs the QA_TOKEN secret`, `… needs QA_EMAIL_DOMAIN`                          | `bun run setup:secrets --env <env>` (`QA_TOKEN`), or set `QA_BYPASS` to `off`.                                                                 |
| The QA suite fails sign-up with "The human check did not pass"                               | `qa.bypass.rejected` in Workers Logs says why: the GitHub `QA_TOKEN` differs from the Worker secret, or the address is not `@QA_EMAIL_DOMAIN`. |

Avatar and logo uploads require the same origin; reading the current image (`/api/account/avatar/[version]`, `/api/workspaces/[workspaceId]/logo/[version]`) is authenticated and exempt in `RATE_LIMIT_EXEMPT`.
