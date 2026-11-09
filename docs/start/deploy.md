# Deploy

::reviewed{date="2026-11-09"}

Deploy an environment (`develop`, `staging` or `production`) to your Cloudflare account: create its database, storage and queues, choose its settings, set its secrets, migrate and ship. Every setup script takes `--dry-run` and asks before it changes anything. Starting a new product from the template? Use [the start prompt](../guides/how-to-start-a-project.md) instead: it does all of this.

::flow[Resources -> Domain and email -> Product settings -> Migrate and deploy -> Secrets -> Verify]{title="Deploying: create the resources, set the domain and email, choose the product settings, migrate and deploy, set the secrets, verify"}

:::prompt{title="Paste this into your coding agent"}
```text
Deploy this app to <environment> on my Cloudflare account. Run every setup script with
--dry-run first and show me the plan; ask before each change to my account; I will type
the secrets myself. Then verify /health/ready and the sign-up page.
```
:::

:::byhand
1. `bunx wrangler login`.
2. **Resources:** `bun run setup:cloudflare --env production` creates the database, the bucket and the queues and writes their ids into `apps/web/wrangler.jsonc` (`--jurisdiction eu` keeps data in the EU).
3. **Domain:** put the hostname in `routes` of the environment with `"custom_domain": true` and `"workers_dev": false`.
4. **Email:** `bun run setup:email --domain example.com --from noreply@example.com --env production`.
5. **Product settings:** `bun run setup:auth --env production` (sign-in, two-factor, workspaces, sign-up, billing, admin portal) and `bun run setup:analytics --env production`.
6. **Turnstile:** a Managed widget for the hostname; its site key in `TURNSTILE_SITE_KEY`.
7. **Migrate and deploy:** `cd apps/web && bunx wrangler d1 migrations apply DB --remote --env production && bun run deploy:production`.
8. **Secrets:** `bun run setup:secrets --env production`. A brand-new Worker answers 500 until they are set.

Every command with its options and why: [the deploy steps](../reference/deployment.md#deploy).
:::

:::gotcha{title="Build for the environment you deploy"}
`deploy:production` builds with `CLOUDFLARE_ENV=production`. Running `wrangler deploy --env production` on a bundle built without it deploys the develop config.
:::

## Verify

:::steps
1. **Health:** `curl -i https://<your-domain>/health/ready` answers 200 with `"status":"pass"`; point an uptime monitor at it.
2. **Sign-up:** the bot check appears and passes; sign out and in again.
3. **Docs:** `/docs/` opens and a guide opens from its navigation.
   :::

Then run the [production smoke suite](../guides/how-to-qa-a-deployment.md), and set up [deploys from GitHub](../guides/how-to-setup-ci.md).

## Reference

Every binding, var and secret, the deploy steps in full, queues and cron, and common problems: [Deployment reference](../reference/deployment.md); every setting: [Settings](../reference/settings.md).
