# How To Setup And Deploy The Storybook Worker

This guide explains how to keep Storybook separate from the main web worker and protect it behind Cloudflare Access.

The Storybook workspace lives entirely in [apps/storybook](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/storybook) — authoring config, build, and Worker deploy target. The built static bundle is written to `apps/storybook/dist` and served by a dedicated Cloudflare Worker.

## Why This Exists

The main web app no longer ships Storybook assets.

- `apps/web` serves the public SSR pages, auth pages, API routes, and the `/app/*` SPA.
- `apps/storybook` serves only the static Storybook bundle.
- Access control for Storybook is handled at the Cloudflare edge with Cloudflare Access.

Official references:

- [Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Access applications](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/)
- [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## Step 1: Install Dependencies

From the repo root:

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter
bun install
```

## Step 2: Develop Storybook Locally

For local UI work, keep using the existing Storybook workspace:

```bash
bun run storybook
```

This starts Storybook on `http://localhost:6006`.

Story locations and config:

- [packages/ui/src/components](/Users/premylsciompa/dev_personal/cloudflare-starter/packages/ui/src/components)
- [apps/storybook/.storybook](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/storybook/.storybook)

## Step 3: Build The Static Storybook Bundle

Build the static bundle from the repo root:

```bash
bun run build-storybook
```

The generated output is written to:

- [apps/storybook/dist](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/storybook)

You can also build from the workspace directly:

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter/apps/storybook
bun run build
```

## Step 4: Review The Storybook Worker Config

The Storybook worker configuration lives here:

- [apps/storybook/wrangler.jsonc](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/storybook/wrangler.jsonc)
- [apps/storybook/package.json](/Users/premylsciompa/dev_personal/cloudflare-starter/apps/storybook/package.json)

Important behavior:

- This worker serves static Storybook assets only.
- The main web worker does not route or redirect to Storybook.
- Cloudflare Access is expected to protect the Storybook hostname.

## Step 5: Authenticate Wrangler

If you are not already logged in:

```bash
bunx wrangler login
```

Optional check:

```bash
bunx wrangler whoami
```

## Step 6: Deploy The Storybook Worker

From the deploy target:

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter/apps/storybook
bun run deploy
```

Or from the repo root:

```bash
cd /Users/premylsciompa/dev_personal/cloudflare-starter
bun run deploy:storybook
```

## Step 7: Attach A Dedicated Hostname

Attach a dedicated hostname or subdomain to the Storybook worker, for example:

- `storybook.example.com`
- `ui-preview.example.com`

Recommended approach:

1. Open the deployed `cloudflare-starter-storybook` worker in the Cloudflare dashboard.
2. Add a custom domain for the hostname you want to use.
3. Confirm DNS and SSL complete successfully.

## Step 8: Protect The Hostname With Cloudflare Access

Once the custom domain is attached, create a Cloudflare Access application for it.

Recommended setup:

1. Open Cloudflare Zero Trust.
2. Create a new self-hosted application for the Storybook hostname.
3. Add an allow policy for the people or groups who should be able to use Storybook.
4. Keep the policy at the hostname level so all Storybook routes inherit the same protection.

Examples of allowed identities:

- a specific email allowlist
- your organization identity provider group
- a small engineering or design team list

## Step 9: Verify The Deployment

1. Open the Storybook hostname while signed out of Cloudflare Access and confirm access is blocked.
2. Authenticate through Cloudflare Access.
3. Confirm Storybook loads and stories render correctly.

## Common Problems

### The Storybook Worker Deploys But Serves Old Assets

Symptom:

- The deploy succeeds, but old stories or stale UI changes appear.

Fix:

- Run `bun run build-storybook` again.
- Confirm fresh files were written into `apps/storybook/dist`.
- Redeploy the Storybook worker.

### The Storybook Hostname Is Public

Symptom:

- Anyone who knows the hostname can open Storybook.

Fix:

- Confirm a Cloudflare Access self-hosted application exists for the Storybook hostname.
- Confirm the access policy is enforced on the exact hostname you attached to the worker.

## Quick Checklist

1. `bun install`
2. `bun run storybook`
3. `bun run build-storybook`
4. `cd apps/storybook`
5. `bun run deploy`
6. Attach a custom hostname in Cloudflare
7. Create a Cloudflare Access application for that hostname
