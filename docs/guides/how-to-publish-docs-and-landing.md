# How to publish the docs and the public pages

The web Worker serves a public docs site at `/docs` built from the repository's own Markdown, and a public 404 page. Both are prerendered at build time: the HTML is the same for every visitor, needs no session and is served as a static asset. Use when you add, move or rename a doc, change what the site publishes or how its navigation is built, fix a broken docs link, or change the public pages' header or theme.

## What is published

`apps/web/src/docs/docs.config.ts` (`DOCS`) decides:

| Setting             | What it does                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sources`           | Globs from the repository root; each matching file is one page. Today `docs/**/*.md`, `README.md`, `apps/*/README.md`, `packages/*/README.md` and `packages/ui/CONVENTIONS.md`                                                                                                                                               |
| `routes`            | URL overrides. By default a file is served at its path without `.md`, without a leading `docs/` and a trailing `README`, in lower case: `docs/guides/how-to-setup-d1.md` is `/docs/guides/how-to-setup-d1/`, `apps/web/README.md` is `/docs/apps/web/`, `docs/README.md` is `/docs/`. The root `README.md` is `/docs/start/` |
| `navSource`         | The file the navigation is built from: `docs/README.md`                                                                                                                                                                                                                                                                      |
| `start`             | The first navigation section (the index and the root README)                                                                                                                                                                                                                                                                 |
| `exempt`            | Files under `docs/` that may stay out of the navigation, each with a reason                                                                                                                                                                                                                                                  |
| `repoUrl`, `branch` | Where "Edit this page on GitHub" and links to unpublished files point                                                                                                                                                                                                                                                        |

The pages are read by an Astro content collection (`apps/web/src/content.config.ts`, a `glob` loader over the repository root) and rendered by `apps/web/src/pages/docs/[...slug].astro` with `export const prerender = true`.

## Write docs that work on GitHub and on the site

Write links as you always do: relative paths between files (`[testing.md](../architecture/testing.md#e2e-tests)`). A Sätteri hast plugin (`apps/web/src/docs/markdown-plugins.ts`, registered under `markdown.processor` in `apps/web/astro.config.mjs`) rewrites them while the page is built (`apps/web/src/docs/links.ts`):

- a published Markdown file becomes its page, keeping the `#fragment`: `/docs/architecture/testing/#e2e-tests`;
- any other file becomes its GitHub page (`…/blob/main/apps/web/wrangler.jsonc`), a folder (`../.claude/skills/`) its GitHub tree;
- absolute URLs, site paths (`/app`) and `#fragments` stay as they are.

Heading ids are GitHub's (github-slugger), so a fragment that works on GitHub works on the site. Each table is wrapped in a keyboard-scrollable box; code blocks are highlighted by Shiki in both themes (`markdown.shikiConfig`, colours switched by `packages/ui/src/styles/prose.css`). Mermaid blocks are shown as code.

## Add, move or remove a doc

1. Write the doc under `docs/` with a `# Title` first line (the page title, the navigation label without a leading "How to").
2. Add a row for it to the right table of [docs/README.md](../README.md), its link in the first cell. That row puts it in the navigation, in the same order.
3. Run `bun run test:unit`. `test/architecture/docs.test.ts` fails when a doc under `docs/` is neither in the navigation nor in `DOCS.exempt` (with a reason), when an exemption is stale, when a published file has no title, or when a relative link or `#fragment` in a published file points at nothing.

Moving or renaming a doc changes its URL; old links from outside the site then reach the 404 page.

## The pages

- **Docs page:** the header (site name, the Docs badge, Storybook, GitHub, theme switch), the navigation (`DocsNav`), the breadcrumb, the rendered Markdown (`Prose`), previous and next page, "Edit this page on GitHub", and "On this page" (`TableOfContents`, the page's second- and third-level headings, on wide screens). Under 1024 px the navigation is a "Docs menu" disclosure above the page. The components are in `packages/ui` (group `site`) with stories.
- **404:** `apps/web/src/pages/404.astro`, prerendered, for every unknown path outside the SPA, with links home and to the docs.
- **Layout:** `apps/web/src/layouts/PublicLayout.astro` is the document shell of these pages. It reads no session, so the HTML can be built once.

## Theme

The public pages follow the OS setting until the visitor picks a theme with the switch in the header; the choice is kept in `localStorage` (`site-theme`) and applied before the first paint by `apps/web/public/site-theme.js`, a blocking script in the head. It is an external file, not inline code, so the pages' Content-Security-Policy allows it without `'unsafe-inline'`, a hash or a nonce. The docs pages are static assets; their policy is a `_headers` rule plus Astro's `<meta>` policy ([how-to-configure-security-headers.md](how-to-configure-security-headers.md#prerendered-pages)). The `/app` theme is a user setting and separate.

## Check it locally

```bash
bun run dev:web                     # /docs renders on request in dev
cd apps/web && bun run build:app    # prerenders every page into dist/client/docs/
```

`bun run test:e2e` includes `test/e2e/docs.spec.ts` (landing → docs → a guide, the theme switch, the 404).

## Common problems

### A doc is missing from the site

Its path does not match `DOCS.sources`. Add a glob, or move the file under `docs/`.

### `docs.test.ts` fails with "is in the navigation or exempt with a reason"

Add a row for the doc to [docs/README.md](../README.md), or an entry to `DOCS.exempt` saying why it is not in the navigation.

### `docs.test.ts` fails with "no heading #… in …"

The heading the link points at was renamed or removed. Point the link at the current heading; ids are the heading text in lower case, spaces as `-`, punctuation dropped.
