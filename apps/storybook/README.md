# @cloudflare-starter/storybook

Standalone Storybook workspace and Cloudflare Worker deploy target. Storybook authoring and the static deploy target both live here — Storybook is intentionally isolated from the main web worker.

See [docs/how-to-setup-storybook-worker.md](../../docs/how-to-setup-storybook-worker.md) for setup, the Cloudflare Access boundary, and deployment.

## Layout

- UI stories live in [`packages/ui/src/components/*.stories.tsx`](../../packages/ui/src/components)
- Storybook config lives in `.storybook/`
- The built static bundle is written to `./dist` and served by a dedicated Cloudflare Worker

## Develop

```bash
bun run storybook
```

Runs on port `6006`.

## Deploy

```bash
bun run deploy:storybook
```

Builds the static bundle and runs `wrangler deploy`. Protect the public hostname with Cloudflare Access.
