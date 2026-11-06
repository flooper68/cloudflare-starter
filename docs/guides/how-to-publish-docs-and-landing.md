# How to publish the docs and the public pages

The web Worker serves a public docs site at `/docs` built from the repository's own Markdown, and a public 404 page. Both are prerendered at build time: the HTML is the same for every visitor, needs no session and is served as a static asset. Use when you add, move or rename a doc, change what the site publishes or how its navigation is built, fix a broken docs link, change the docs search, page metadata, `robots.txt`, the sitemap or the cache headers of the public pages, or the bundle budget fails.

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

- **Docs page:** the header (site name, the Docs badge, [search](#search), Storybook, GitHub, theme switch), the navigation (`DocsNav`), the breadcrumb, the rendered Markdown (`Prose`), previous and next page, "Edit this page on GitHub", and "On this page" (`TableOfContents`, the page's second- and third-level headings, on wide screens). Under 1024 px the navigation is a "Docs menu" disclosure above the page. The components are in `packages/ui` (group `site`) with stories.
- **404:** `apps/web/src/pages/404.astro`, prerendered, for every unknown path outside the SPA, with links home and to the docs, and the search in its header. It is `noindex`.
- **Layout:** `apps/web/src/layouts/PublicLayout.astro` is the document shell of these pages. It reads no session, so the HTML can be built once.

## Theme

The public pages follow the OS setting until the visitor picks a theme with the switch in the header; the choice is kept in `localStorage` (`site-theme`) and applied before the first paint by `apps/web/public/site-theme.js`, a blocking script in the head. It is an external file, not inline code, so a strict Content-Security-Policy (`script-src 'self'`) allows it without `'unsafe-inline'` or a nonce. The `/app` theme is a user setting and separate.

## Search

The header's "Search docs" button (or ⌘K / Ctrl+K) opens a dialog that searches every docs page.

- **Index:** after `astro build`, the integration in `apps/web/src/docs/search-integration.ts` (`astro:build:done`) runs [Pagefind](https://pagefind.app) over `dist/client/docs/**/*.html` and writes the index and its client into `dist/client/pagefind/`, served at `/pagefind/`. Only the rendered Markdown is indexed (`data-pagefind-body` on `Prose`); each result carries its navigation section (`data-pagefind-meta`). A build fails when nothing was indexed.
- **Dialog:** `apps/web/src/components/site/DocsSearch.astro` is the markup (a native `<dialog>`, a combobox and a listbox); `apps/web/src/docs/search.ts` is the `<docs-search>` custom element, a small module under `/_astro/`. It imports `/pagefind/pagefind.js` the first time the dialog opens, so pages that are never searched never load the index. ↑/↓ move, Enter or a click opens, Esc or a click outside closes.
- **In development:** `astro dev` builds no index; the dialog says "Search could not load". Use `bun run build:app && bunx astro preview` (in `apps/web`) to try it.
- **Content-Security-Policy:** Pagefind runs WebAssembly (`script-src 'wasm-unsafe-eval'`) and may start a worker from `/pagefind/` (`worker-src 'self'`); Shiki colours code with inline `style` attributes (`style-src-attr 'unsafe-inline'`). A CSP for these pages needs those, and nothing else inline: every script is an external file (`vite.build.assetsInlineLimit` keeps Astro from inlining small page scripts).

## Page metadata, robots.txt and the sitemap

- **Title and description:** each docs page's `<title>` is its `# Title` plus "· Cloudflare Starter docs"; the meta description is the doc's first paragraph as plain text, cut to 160 characters (`apps/web/src/docs/meta.ts`). That is one more reason every doc starts with its purpose ([documentation.md](../processes/documentation.md)).
- **Canonical and Open Graph:** `PublicLayout.astro` writes `og:title`, `og:description`, `og:type` and, when the build knows the site's origin, `<link rel="canonical">` and `og:url`.
- **`SITE_URL`:** the origin, read at build time (`site` in `apps/web/astro.config.mjs`). `deploy:production` sets `SITE_URL=https://starter.flooper.me`; a project sets its own domain there. Without it a build warns "SITE_URL is not set" and leaves out the sitemap, canonical and `og:url`.
- **Sitemap:** `@astrojs/sitemap` writes `/sitemap-index.xml` with `/` and every `/docs/` page, only when `SITE_URL` is set.
- **`robots.txt`:** `apps/web/src/pages/robots.txt.ts`, prerendered. A production build (`CLOUDFLARE_ENV=production`) disallows `/app`, `/api`, `/admin`, `/_storybook` and `/health` and lists the sitemap; every other build disallows everything, so staging and develop are never indexed.

## Caching

`apps/web/public/_headers` sets `Cache-Control` for static assets (Workers static assets honour `_headers`; the Astro Cloudflare adapter appends the `/_astro/*` rule):

| Path                                                                          | Cache-Control                         | Why                                              |
| ----------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| `/_astro/*`                                                                   | `public, max-age=31536000, immutable` | content-hashed file names (added by the adapter) |
| `/pagefind/*`                                                                 | `public, max-age=31536000, immutable` | index chunks and fragments are content-hashed    |
| `/pagefind/pagefind.js`, `/pagefind/pagefind-*` (entry, worker, UI), `wasm.*` | `public, max-age=300`                 | fixed names that change with every build         |
| `/docs/*`                                                                     | `public, max-age=0, must-revalidate`  | a deploy shows at once; the ETag makes it cheap  |

The rules apply only to responses served from the static assets, not to pages the Worker renders on request (`/` today, sign-in, `/app`). Check them with `curl -I` against `bunx astro preview` (it serves the build like Cloudflare does) or a deployment.

## Bundle budget

`bun run budget` (after `bun run build`; CI runs it in the `build` job) checks the budgets in [performance.md](../architecture/performance.md#targets): each prerendered page loads at most 50 KB gzip of JavaScript on first load (its scripts and their static imports), and each Pagefind file is at most 100 KB gzip. It prints the heaviest pages and files (`scripts/check-bundle-budget.ts`). A page over budget is a regression: drop the dependency, load it lazily, or change the budget with a reason ([performance.md](../architecture/performance.md#regressions-and-budget-changes)).

## Check it locally

```bash
bun run dev:web                     # /docs renders on request in dev
cd apps/web && bun run build:app    # prerenders every page into dist/client/docs/
```

`bun run test:e2e` includes `test/e2e/docs.spec.ts` (landing → docs → a guide, the theme switch, the 404). `bun run test:e2e:static` builds the app, serves it with `astro preview` on the port after `APP_URL`'s and runs `test/e2e/static/`: the search dialog, page metadata, `robots.txt`, and axe on `/`, `/docs/`, a guide and the open search dialog in both themes. The production smoke suite checks `/docs/` and a search on the deployment ([how-to-qa-a-deployment.md](how-to-qa-a-deployment.md)).

## Common problems

### A doc is missing from the site

Its path does not match `DOCS.sources`. Add a glob, or move the file under `docs/`.

### `docs.test.ts` fails with "is in the navigation or exempt with a reason"

Add a row for the doc to [docs/README.md](../README.md), or an entry to `DOCS.exempt` saying why it is not in the navigation.

### Search says "Search could not load"

The page has no index: `astro dev` builds none (use a build and `astro preview`), or `/pagefind/pagefind.js` failed to load (check the network tab; a Content-Security-Policy without `'wasm-unsafe-eval'` blocks it).

### `bun run budget` fails

It names the page and its files. A new dependency in a page script, or a component hydrated on a public page (`client:*`), is the usual cause.

### `docs.test.ts` fails with "no heading #… in …"

The heading the link points at was renamed or removed. Point the link at the current heading; ids are the heading text in lower case, spaces as `-`, punctuation dropped.
