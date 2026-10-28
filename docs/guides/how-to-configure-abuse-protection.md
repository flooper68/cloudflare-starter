# How To Configure Abuse Protection (Rate Limits And Turnstile)

The web app limits how often each IP and each user may call it, and asks for a Cloudflare Turnstile check on sign-up, sign-in and password reset. This guide covers the settings, the Cloudflare setup per environment, how to change or add a limit, and how to swap in another limiter or verifier. The rules behind it are in [overview.md#abuse-protection](../architecture/overview.md#abuse-protection). Use when you set up an environment, tune a limit, give a new procedure or route a policy, or debug a 429 or a failed human check.

## What Is Wired Up

| Where                                                                            | Policy (catalog id)                                                                                                                                                          | Enforced by                                                                                                                                          |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every `/api/auth/*` request                                                      | `auth.ip` (per IP)                                                                                                                                                           | `RL_AUTH_IP` binding, before Better Auth                                                                                                             |
| `/sign-in/*`, `/sign-up/*`, `/request-password-reset`                            | `auth.sign-in`, `auth.sign-up`, `auth.password-reset`                                                                                                                        | Better Auth's limiter (counters in D1)                                                                                                               |
| `/oauth2/register`, `/oauth2/token`, `/oauth2/authorize`                         | `auth.oauth-*`                                                                                                                                                               | Better Auth's limiter                                                                                                                                |
| `/send-verification-email` (anonymous, mails any address)                        | `auth.verification-email` (3 a minute per IP)                                                                                                                                | Better Auth's limiter. No human check: no page of ours sends this request, so no widget could supply a token; the tight limit and `auth.ip` bound it |
| Every tRPC mutation (web and MCP tool calls)                                     | `mutation.user` unless `PROCEDURE_POLICIES` says otherwise                                                                                                                   | `RL_MUTATION`, tRPC middleware (`init.ts`)                                                                                                           |
| `storage.createUpload`, `POST /api/files`                                        | `upload.user`                                                                                                                                                                | `RL_UPLOAD`                                                                                                                                          |
| `/mcp`                                                                           | `mcp.ip` (600/min, MCP clients share server IPs) before the token is verified, `mcp.user` after                                                                              | `RL_MCP_IP`, `RL_MCP_USER`                                                                                                                           |
| `workspace.invitations.create` (mails a link)                                    | `invitation.send`                                                                                                                                                            | `RL_INVITE`                                                                                                                                          |
| `/invite/[token]` (looks up an invitation token from the URL)                    | `token.lookup` (30 a minute per IP)                                                                                                                                          | `RL_TOKEN_LOOKUP`, in the page before the lookup                                                                                                     |
| `POST /api/billing/webhook` (payment provider events)                            | `billing.webhook` (300 a minute per IP: providers send from a few shared IPs)                                                                                                | `RL_BILLING_WEBHOOK`, in the route before the signature check                                                                                        |
| `analytics.track` (client analytics batches)                                     | `analytics.client` (120 a minute per user), not `mutation.user`                                                                                                              | `RL_ANALYTICS`                                                                                                                                       |
| Sign-up, sign-in, password reset (email + password)                              | Turnstile human check                                                                                                                                                        | Better Auth `hooks.before` → `HumanVerifier`                                                                                                         |
| Password reset link an admin sends (in-process `auth.api` call, no HTTP request) | none: no visitor to check; `adminProcedure` authorized the admin. Only `/request-password-reset`, and only without an incoming request (`isInProcessCall` in server/auth.ts) | `apps/web/test/api/admin.test.ts` proves HTTP requests without a token are still refused                                                             |

The numbers live in one place: `RATE_LIMIT_POLICIES` in [packages/features/src/abuse/domain/policies.ts](../../packages/features/src/abuse/domain/policies.ts). User-scoped policies count a signed-in user by id and an anonymous caller by IP (`CF-Connecting-IP`).

What the caller sees:

- **Headers** ([draft-ietf-httpapi-ratelimit-headers-11](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/), Structured Field Lists): a limited request that is allowed names its quotas, `RateLimit-Policy: "auth.ip";q=60;w=60, "auth.sign-in";q=10;w=60`. A refused one adds `Retry-After: <seconds>` and `RateLimit: "<policy>";r=0;t=<seconds>`. Workers Rate Limiting does not say how much quota is left, so `RateLimit` is sent only on refusals. Sent by `/api/auth/*`, `POST /api/files`, `/mcp` and tRPC mutations.
- **tRPC:** `TOO_MANY_REQUESTS` (HTTP 429).
- **MCP tools:** a tool error `{ code: "TOO_MANY_REQUESTS", httpStatus: 429, retryAfterSeconds }`; `/mcp` itself answers a JSON-RPC error (`data.retryAfterSeconds`) with HTTP 429.
- **Other HTTP routes** (`/api/auth/*`, `/api/files`): [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details, `application/problem+json`, built by `problemResponse` (`apps/web/src/server/http.ts`) in `apps/web/src/server/rate-limited-response.ts`, with `reference` (the trace id users quote, also `x-request-id`) and `code` (`RATE_LIMITED`, `HUMAN_CHECK_FAILED`, `HUMAN_CHECK_UNAVAILABLE`: the `DomainError` codes) as extension members. Better Auth's own 429s are converted too. Example:

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
- **Human check:** refusals are Problem Details with `code` as an extension member (Better Auth's client reads `code` and `detail`). Both fail closed, and each refusal of a request that named an email is recorded in the audit log as `auth.human_check_failed` (`form`, `reason`; [how-to-use-the-audit-log.md](how-to-use-the-audit-log.md)).

Problem types (the `type` URIs point at these sections; a project that publishes its own docs changes `DOCS` in `rate-limited-response.ts`):

### Quota exceeded

`https://iana.org/assignments/http-problem-types#quota-exceeded`, status 429: a rate-limit policy refused the request. `violated-policies` names it, `retryAfterSeconds` says how long to wait (also in `Retry-After`). The type is the one draft-ietf-httpapi-ratelimit-headers proposes to register.

### Human check failed

Status 400, `code: "HUMAN_CHECK_FAILED"`: no Turnstile token, or Siteverify rejected it (invalid, expired, reused, issued for another form). The visitor solves the widget again; the forms reset it after every attempt.

### Human check unavailable

Status 503, `code: "HUMAN_CHECK_UNAVAILABLE"`: Siteverify did not answer (5 s per attempt, one retry with the same idempotency key, so about 10 s at most) or rejected the secret key. The request is refused; the visitor tries again later. Each occurrence is also sent to the ErrorReporter with the request context and the reason (`ERROR_REPORTER`, [how-to-setup-error-reporting.md](how-to-setup-error-reporting.md)): the provider failing is ours to fix.

## Settings

Required in every environment, no defaults; a missing or wrong value fails the first request with an error naming the setting.

| Name                   | Kind                                | Values                                                                                      |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `RATE_LIMITING`        | var (`wrangler.jsonc`, `.dev.vars`) | `cloudflare` (the bindings below) or `none` (nothing is limited, Better Auth's limits stay) |
| `TURNSTILE`            | var                                 | `on` or `off`                                                                               |
| `TURNSTILE_SITE_KEY`   | var (public)                        | the widget's site key; required with `on`                                                   |
| `TURNSTILE_SECRET_KEY` | secret (`.dev.vars`, Worker secret) | the widget's secret key; required with `on`                                                 |

Bindings, in the top level, `env.staging` and `env.production` of `apps/web/wrangler.jsonc`: `RL_AUTH_IP`, `RL_MUTATION`, `RL_MCP_IP`, `RL_MCP_USER`, `RL_UPLOAD`, `RL_INVITE`, `RL_TOKEN_LOOKUP`, `RL_BILLING_WEBHOOK`, `RL_ANALYTICS` (`ratelimits`). Their `limit` and `period` must equal the catalog's; `test/architecture/abuse.test.ts` checks it. `namespace_id` is any positive integer you pick, unique in the Cloudflare account; bindings sharing one share counters, so every environment uses its own ids (1001–1009, 2001–2009, 3001–3009). There is no resource to create.

## Local Development

The top-level `vars` of `apps/web/wrangler.jsonc`, which local dev uses too, set `RATE_LIMITING=cloudflare`, `TURNSTILE=on` and Cloudflare's always-pass test site key; `apps/web/.dev.vars.example` sets the matching test secret `TURNSTILE_SECRET_KEY` and shows how to override the two settings (commented lines). Cloudflare's test keys:

| Key                                          | Behaviour                                           |
| -------------------------------------------- | --------------------------------------------------- |
| site key `1x00000000000000000000AA`          | visible widget, always passes                       |
| site key `2x00000000000000000000AB`          | visible widget, always fails                        |
| secret `1x0000000000000000000000000000000AA` | accepts only the test token `XXXX.DUMMY.TOKEN.XXXX` |
| secret `2x0000000000000000000000000000000AA` | always rejects                                      |

The rate-limit bindings are simulated by Miniflare (windows aligned to the clock). Locally nothing sets `CF-Connecting-IP`, so every local request shares one IP counter; send the header yourself to test per-IP limits, as `apps/web/test/e2e/abuse.spec.ts` does. The widget loads Cloudflare's script, so the sign-up page needs network access.

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
2. Put the site key in `TURNSTILE_SITE_KEY` of that environment's `vars` in `apps/web/wrangler.jsonc` (the top level is develop). The starter ships the always-pass test key there; `bun run doctor` warns while staging or production still has it.
3. `bun run setup:secrets --env <env>` and enter `TURNSTILE_SECRET_KEY`. Setting a secret deploys a new version.
4. Keep `RATE_LIMITING=cloudflare`. Workers Rate Limiting needs Wrangler 4.36 or later (the repository pins a newer one).

`bun run doctor` checks the settings locally and in every environment, the `namespace_id`s for duplicates, and reminds you of the secret.

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

| Layer       | Where                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain      | `packages/features/src/abuse/domain/*.test.ts` (catalog validity, keys, Better Auth rules)                                                                                                                         |
| Integration | `packages/features/src/platform/adapters/**/*.contract*.test.ts` (each adapter against its port contract; the cloudflare limiter on Miniflare's binding)                                                           |
| API         | `apps/web/test/api/abuse.test.ts` (429 with Retry-After, RateLimit fields and Problem Details on a mutation, uploads, `/api/auth/*`, `/mcp`; Turnstile with Siteverify answered by `test/outbound.ts`, no network) |
| Component   | `packages/ui/src/components/human-check.stories.tsx`, `rate-limit-notice.stories.tsx`                                                                                                                              |
| E2E         | `apps/web/test/e2e/abuse.spec.ts`                                                                                                                                                                                  |
| Static      | `test/architecture/abuse.test.ts` (coverage, bindings per environment)                                                                                                                                             |

## Troubleshooting

| Symptom                                                                                      | Cause and fix                                                                                         |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Set RATE_LIMITING to cloudflare or none`, `Set TURNSTILE to on or off`                      | The setting is missing in that environment's vars or `.dev.vars`.                                     |
| `TURNSTILE=on needs the TURNSTILE_SECRET_KEY secret`                                         | `bun run setup:secrets --env <env>`, or copy it from `.dev.vars.example` locally.                     |
| `RATE_LIMITING=cloudflare needs the RL_… ratelimits binding`                                 | The binding is missing in that environment of `wrangler.jsonc`.                                       |
| Every sign-up fails with "The human check did not pass"                                      | Site key and secret key belong to different widgets, or a test site key is paired with a real secret. |
| An error report "Siteverify rejected the secret key" (attribute `app.auth.human_check.form`) | `TURNSTILE_SECRET_KEY` is wrong for this widget.                                                      |
| Everyone shares one limit                                                                    | Requests arrive without `CF-Connecting-IP` (local dev, or a proxy in front of the Worker).            |
