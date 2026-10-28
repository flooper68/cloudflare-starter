# How To Use Storybook

Storybook documents the component library (`packages/ui`) and is the place to build and review
components in isolation, in both themes.

## Where It Lives

- Authoring: `apps/storybook` (config) and stories next to components in `packages/ui/src`.
- Published: inside the web app at **`<APP_URL>/_storybook/`**, in every environment. There is
  no separate Worker. `apps/web`'s `build` runs `storybook build --output-dir
  ../web/public/_storybook` first, and Astro ships `public/` as static assets, so the
  Worker's static-asset handling serves it without running app code. The folder is
  gitignored.

## Develop

```bash
bun run storybook          # http://localhost:6006
```

Locally, `bun run dev:web` serves `/_storybook/` only if you ran `bun run build-storybook`
before; use the dev server for day-to-day work.

## Writing Stories

Follow [packages/ui/CONVENTIONS.md](../packages/ui/CONVENTIONS.md): title `<Group>/<Component>`,
`tags: ["autodocs"]`, a Playground, every variant and state, and one realistic example. The
toolbar switches between the dark and light theme; the Accessibility panel runs axe on the
current story.

## Access

`/_storybook/` is public like the rest of the static assets: it contains only components and
sample data. If a project needs it private, protect the path with Cloudflare Access (a
self-hosted application on `<domain>/_storybook*`), or remove the Storybook step from
`apps/web`'s `build` script and run it only locally.

## Removing It

Delete `apps/storybook`, the `*.stories.tsx`/`*.mdx` files, the root `storybook` and
`build-storybook` scripts, and change `apps/web`'s `build` script to `astro build`.
