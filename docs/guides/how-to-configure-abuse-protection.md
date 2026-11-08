# How to configure abuse protection (rate limits and Turnstile)

::reviewed{date="2026-11-09"}

Every IP and every user gets a limit on how often they may call the app, and sign-up, sign-in and password reset ask for a Cloudflare Turnstile check. Use this guide to set it up for an environment, tune a limit, or give a new mutation or route its own policy. The rules behind it: [overview.md#abuse-protection](../architecture/overview.md#abuse-protection); every policy and its numbers: [Catalogs › Rate limits](../reference/catalogs.md#rate-limits).

::flow[Request -> Limit per IP or user -> Human check on auth forms -> Your code]{title="Abuse protection: each request is counted per IP or user, auth forms also pass a human check, then the code runs"}

## Set up an environment

:::settings
- RATE_LIMITING = cloudflare (cloudflare | none) Rate limits through the Workers Rate Limiting bindings
- TURNSTILE = on (on | off) The bot check on sign-up, sign-in and password reset
  :::

:::prompt{title="Paste this into your coding agent"}
```text
Set up Turnstile for production: walk me through creating a Managed widget for the
production hostname, put its site key in wrangler.jsonc, set TURNSTILE_SECRET_KEY with
setup:secrets, and run doctor.
```
:::

:::byhand
1. Cloudflare dashboard › Turnstile › Add widget, mode **Managed**, hostname the environment's domain.
2. Put the site key in that environment's `TURNSTILE_SITE_KEY` in `apps/web/wrangler.jsonc`.
3. `bun run setup:secrets --env <env>` and enter `TURNSTILE_SECRET_KEY`.
4. `bun run doctor`: it warns while staging or production still has Cloudflare's always-pass test key.
   :::

Locally nothing to do: the test keys always pass, and the limiter is simulated.

## Change a limit

:::steps
1. **Edit the policy** in `RATE_LIMIT_POLICIES` (`packages/features/src/abuse/domain/policies.ts`).
2. **Edge policy?** Set the same `limit` and `period` on its binding in all three environments of `wrangler.jsonc`. Better Auth policies need nothing else.
3. **Run `bun run test`**: the architecture test compares the catalog with the bindings.
   :::

## Give a mutation or a route its own policy

Every tRPC mutation is limited by `mutation.user` already. Anything that sends mail, invites or costs money gets a tighter edge policy with its own binding and a `PROCEDURE_POLICIES` entry; an endpoint under `apps/web/src/pages` calls `refuseOverLimit` before doing work and is listed in `ROUTE_POLICIES` ([details](../reference/abuse-protection.md#give-a-mutation-or-route-a-policy)).

:::decision{title="Why limits live in one catalog"}
The edge bindings, Better Auth's rules and the tests all read the same numbers, so a limit cannot differ between the code, the config and the docs.
:::

:::gotcha{title="Locally every request shares one IP"}
Nothing sets `CF-Connecting-IP` in development. Send the header yourself to test per-IP limits.
:::

## Reference

What is wired where, what a refusal looks like, the QA bypass, namespace ids, another limiter or verifier, tests and troubleshooting: [Abuse protection reference](../reference/abuse-protection.md).
