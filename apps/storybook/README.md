# @cloudflare-starter/storybook

Storybook for the component library in [`packages/ui`](../../packages/ui/README.md). It has no
Worker of its own: the static build is written into the web app (`apps/web/public/_storybook`)
and served at **`/_storybook/`** of every environment.

- Stories: `packages/ui/src/**/*.stories.tsx` and `*.mdx`
- Config: `.storybook/` (theme toolbar, docs, a11y as a test gate)
- Component tests: `vitest.config.ts` runs every story in Chromium (Vitest browser mode), once
  per theme, with axe and its `play` function

```bash
bun run storybook         # dev server on :6006
bun run build-storybook   # static build into apps/web/public/_storybook
bun run test:components   # every story as a test (once: cd apps/web && bunx playwright install chromium)
```

The web app's `build` (and so every `deploy:*`) builds Storybook first. See
[docs/guides/how-to-use-storybook.md](../../docs/guides/how-to-use-storybook.md).
