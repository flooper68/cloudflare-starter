# @cloudflare-starter/storybook

Storybook for the component library in [`packages/ui`](../../packages/ui/README.md). It has no
Worker of its own: the static build is written into the web app (`apps/web/public/_storybook`)
and served at **`/_storybook/`** of every environment.

- Stories: `packages/ui/src/**/*.stories.tsx` and `*.mdx`
- Config: `.storybook/` (theme toolbar, docs, a11y)

```bash
bun run storybook         # dev server on :6006
bun run build-storybook   # static build into apps/web/public/_storybook
```

The web app's `build` (and so every `deploy:*`) builds Storybook first. See
[docs/how-to-use-storybook.md](../../docs/how-to-use-storybook.md).
