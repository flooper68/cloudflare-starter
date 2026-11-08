# How to publish the docs and the landing page

The web Worker serves a landing page at `/`, a public docs site at `/docs` built from the repository's own Markdown, and a public 404 page. All three are prerendered at build time: the HTML is the same for every visitor, needs no session and is served as a static asset. Use when you change or replace the landing page, add, move or rename a doc, change what the site publishes or how its navigation is built, fix a broken docs link, change the docs search, page metadata, `robots.txt`, the sitemap or the cache headers of the public pages, or the bundle budget fails.

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

Heading ids are GitHub's (github-slugger), so a fragment that works on GitHub works on the site. Each table is wrapped in a keyboard-scrollable box; code blocks are highlighted by Shiki in both themes (`markdown.shikiConfig`, colours switched by `packages/ui/src/styles/prose.css`). A ` ```mermaid ` block is shown as code on the site; for a diagram, use an SVG, hand-drawn or generated from a Mermaid source ([Diagrams](#diagrams)).

### Diagrams

A paragraph that is only an image of an SVG in the repository is a diagram: `![The lifecycle of a change](images/agentic-lifecycle.svg)`. GitHub shows the file as an image. The site inlines the SVG itself into the page (a Sätteri mdast plugin, `docsDiagramsPlugin` with `apps/web/src/docs/diagrams.ts`), in a `<figure data-docs-diagram>` named by the alt text that scrolls sideways on phones, so the diagram's own `<style>` can use the site's tokens and follows the theme switch:

- colour with classes and `var(--ui-fg, <fallback>)`-style tokens (`--ui-surface`, `--ui-line-strong`, `--ui-accent`, `--ui-fg-muted`), with fallback colours for GitHub and a `@media (prefers-color-scheme: dark)` block that also uses the tokens first;
- give the root `<svg>` a `viewBox`, a `width` and `height` (its size on GitHub), `role="img"` and a `<title>`, and the image alt text; no blank lines (a blank line ends the inlined HTML), no script, no event handlers;
- prefix class names and marker ids (`dg-`, `dg-<diagram>-arrow`): every inlined SVG shares the page's styles and ids.

The build fails when an inlined SVG has no `<title>` or alt text, or contains script. The docs pages allow inline styles (`style-src 'unsafe-inline'`), so the inlined `<style>` passes their Content-Security-Policy. Examples: `docs/processes/images/`.

#### From a Mermaid source

For boxes and arrows or a sequence, write the diagram in Mermaid instead of drawing it: a `<name>.mmd` file under `docs/` with an `accTitle:` and an `accDescr:` line (Mermaid's accessibility syntax: a short name, then what the diagram shows in sentences). `bun run docs:diagrams` writes `<name>.svg` beside it (`apps/web/scripts/render-diagrams.ts`, `apps/web/src/docs/mermaid-svg.ts`, with [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid), which needs no browser), following the rules above: token colours with fallbacks for both schemes, `<title>` and `<desc>` from the two lines, marker ids prefixed with the file name, which is therefore unique. Commit both files and link the `.svg` like any diagram. A generated diagram keeps its own size on the site (`data-natural-width`) and scrolls sideways when wider than the column. `apps/web/src/docs/mermaid-svg.test.ts` fails when an `.svg` differs from what its source renders to, or a source lacks either line. Flowcharts, sequence, state, class and ER diagrams work; keep to plain syntax (no `classDef`, `style` or `click`) and quote labels with punctuation (`A["/api/trpc"]`). Examples: `docs/architecture/diagrams/`.

## Add, move or remove a doc

1. Write the doc under `docs/` with a `# Title` first line (the page title, the navigation label without a leading "How to").
2. Add a row for it to the right table of [docs/README.md](../README.md), its link in the first cell. That row puts it in the navigation, in the same order.
3. Run `bun run test:unit`. `test/architecture/docs.test.ts` fails when a doc under `docs/` is neither in the navigation nor in `DOCS.exempt` (with a reason), when an exemption is stale, when a published file has no title, or when a relative link or `#fragment` in a published file points at nothing.

Moving or renaming a doc changes its URL; old links from outside the site then reach the 404 page.

## The pages

- **Docs page:** the header (site name, the Docs badge, [search](#search), Storybook, GitHub, theme switch), the navigation (`DocsNav`), the breadcrumb, the rendered Markdown (`Prose`), previous and next page, "Edit this page on GitHub", and "On this page" (`TableOfContents`, the page's second- and third-level headings, on wide screens). Under 1024 px the navigation is a "Docs menu" disclosure above the page. The components are in `packages/ui` (group `site`) with stories.
- **404:** `apps/web/src/pages/404.astro`, prerendered, for every unknown path outside the SPA, with links home and to the docs, and the search in its header. It is `noindex`.
- **Landing page:** see [below](#the-landing-page).
- **Layout:** `apps/web/src/layouts/PublicLayout.astro` is the document shell of these pages. It reads no session, so the HTML can be built once.
- **Account pages** (sign-in, sign-up, password reset, verification, invitations, consent, two-factor) are rendered per request on `apps/web/src/layouts/Layout.astro`, with the same `SiteHeader` (Docs, Changelog, Storybook, GitHub) plus **Sign in** and **Sign up**, or **Open app** when signed in. They have no theme switch (`themeToggle={false}`): their per-request policy runs scripts only from `/_astro/`, not `/site-theme.js`, so the OS setting applies. Demo endpoints such as `/api/hello` are not in the public header; they are on the app's **Developer demos** page.

## The landing page

`apps/web/src/pages/index.astro`, prerendered on `PublicLayout`: the starter's own page, built from `packages/ui` components (`Hero`, `FeatureGrid`, `Badge`, button styles) and the header with search, Storybook, GitHub, **Sign in** and **Open app**. All copy and links are in `apps/web/src/landing/content.ts`; the feature cards summarise the README's Highlights, so change both together. The hero's app picture is `apps/web/src/components/site/LandingPreview.astro` (decorative, `aria-hidden`).

The page reads no session, so it is the same for everyone: a signed-in visitor sees "Open app" (`/app/dashboard`), and a signed-out one who clicks it lands on `/sign-in`. It ships no React; its only scripts are the theme and search ones.

### Replace the landing page

A product built from the starter replaces this page with its own:

1. Rewrite `apps/web/src/landing/content.ts` (or delete it) and the sections of `index.astro`. Keep `export const prerender = true` and `PublicLayout` unless the page must know who is signed in; a page that reads the session is rendered per request, and its `Cache-Control` must then not be `public` (remove `/` from `PRERENDERED_PAGE_PATHS` in `apps/web/src/server/security-headers.ts` and from `STATIC_CACHE_RULES` in `static-cache.ts`, then regenerate `_headers`).
2. Set `DOCS.siteName` (`apps/web/src/docs/docs.config.ts`) to the product's name; it is the header and the page titles.
3. Decide whether the product publishes the repository's docs. To publish product docs instead, point `DOCS.sources`, `navSource` and `start` at them. To drop the docs site:
   - delete `src/pages/docs/`, `src/content.config.ts`, `components/site/DocsSearch.astro` and its uses, and in `src/docs/` the docs-only modules (`links.ts`, `nav.ts`, `meta.ts`, `markdown-plugins.ts`, `search*.ts` and their tests); keep `docs.config.ts` (`siteName` and `repoUrl` are used by the header, the layout, the landing and the 404; drop its other fields), `robots.ts` and `site-integrations.ts` without `docsSearch()` (the sitemap);
   - remove `markdown` and the Pagefind import from `apps/web/astro.config.mjs`, the `/pagefind/*` and `/docs/*` entries of `PRERENDERED_PAGE_PATHS`, `PAGEFIND_CSP` and `STATIC_CACHE_RULES` (then regenerate `_headers`), and the Pagefind budget from `scripts/check-bundle-budget.ts`;
   - remove the Docs links (header, landing, 404), `test/architecture/docs.test.ts`, `test/e2e/docs.spec.ts`, `test/e2e-build/search.spec.ts` and `docs.spec.ts`, the `/docs/` paths in `test/e2e-build/a11y.spec.ts` and `landing.spec.ts`, and the docs rows of the smoke suite.
4. Run `bun run build`, `bun run budget` and `bun run test:e2e:build` (landing, its policy, axe in both themes, phone width).

## Changelog

`/docs/changelog/` renders the root [CHANGELOG.md](../../CHANGELOG.md) (the docs collection reads it like any published file; there is no copy) as release notes: `apps/web/src/pages/docs/changelog.astro` parses it (`apps/web/src/docs/changelog.ts`) and renders `ReleaseNotes` from `packages/ui`, each release with its version, date and compare link, and each change type with its own label colour. Inline Markdown in an entry (`code`, **bold**, links) is rendered as elements (`src/docs/inline.ts`); relative links are rewritten like the rest of the docs. The page is in the navigation's Start section, the sitemap and the search index, and needs no script beyond the docs' own.

`/docs/changelog.xml` is an Atom feed of the released versions (not Unreleased), prerendered by `src/pages/docs/changelog.xml.ts`. Its URLs use `SITE_URL` (set for production); without it the feed has no self link and its entries point at the file on GitHub. It is served as a static asset, typed `application/xml`. The landing page's header and footer and the dashboard link to the changelog.

What goes into the changelog and how a release is cut: [development.md](../processes/development.md#changelog).

## Theme

The public pages follow the OS setting until the visitor picks a theme with the switch in the header; the choice is kept in `localStorage` (`site-theme`) and applied before the first paint by `apps/web/public/site-theme.js`, a blocking script in the head. It is an external file, not inline code, so the pages' Content-Security-Policy allows it without `'unsafe-inline'`, a hash or a nonce. The docs pages are static assets; their policy is a `_headers` rule plus Astro's `<meta>` policy ([how-to-configure-security-headers.md](how-to-configure-security-headers.md#prerendered-pages)). The `/app` theme is a user setting and separate.

## Search

The header's "Search docs" button (or ⌘K / Ctrl+K) opens a dialog that searches every docs page.

- **Index:** after `astro build`, the integration in `apps/web/src/docs/search-integration.ts` (`astro:build:done`) runs [Pagefind](https://pagefind.app) over `dist/client/docs/**/*.html` and writes the index and its client into `dist/client/pagefind/`, served at `/pagefind/`. Only the rendered Markdown is indexed (`data-pagefind-body` on `Prose`); each result carries its navigation section (`data-pagefind-meta`). A build fails when nothing was indexed.
- **Dialog:** `apps/web/src/components/site/DocsSearch.astro` is the markup (a native `<dialog>`, a combobox and a listbox); `apps/web/src/docs/search.ts` is the `<docs-search>` custom element, a small module under `/_astro/`. It imports `/pagefind/pagefind.js` the first time the dialog opens, so pages that are never searched never load the index. ↑/↓ move, Enter or a click opens, Esc or a click outside closes.
- **In development:** `astro dev` builds no index; the dialog says "Search could not load". Use `bun run build:app && bunx astro preview` (in `apps/web`) to try it.
- **Content-Security-Policy:** Pagefind runs WebAssembly, so the docs pages' policy (`PRERENDERED_PAGE_CSP` in `_headers`, and Astro's `<meta>` through `security.csp.scriptDirective`) has `'wasm-unsafe-eval'`, never `'unsafe-eval'`; its worker comes from `/pagefind/` (`worker-src 'self'`). Every script is an external file (`vite.build.assetsInlineLimit` keeps Astro from inlining small page scripts). [how-to-configure-security-headers.md](how-to-configure-security-headers.md#prerendered-pages)

## Page metadata, robots.txt and the sitemap

- **Title and description:** each docs page's `<title>` is its `# Title` plus "· Cloudflare Starter docs"; the meta description is the doc's first paragraph as plain text, cut to 160 characters (`apps/web/src/docs/meta.ts`). That is one more reason every doc starts with its purpose ([documentation.md](../processes/documentation.md)).
- **Canonical and Open Graph:** `PublicLayout.astro` writes `og:title`, `og:description`, `og:type` and, when the build knows the site's origin, `<link rel="canonical">` and `og:url`.
- **`SITE_URL`:** the origin, read at build time (`site` in `apps/web/astro.config.mjs`). `deploy:production` sets `SITE_URL=https://starter.flooper.me`; a project sets its own domain there. Without it a build warns "SITE_URL is not set" and leaves out the sitemap, canonical and `og:url`.
- **Sitemap:** `@astrojs/sitemap` writes `/sitemap-index.xml` with `/` and every `/docs/` page, only when `SITE_URL` is set.
- **`robots.txt`:** `apps/web/src/pages/robots.txt.ts`, prerendered. A production build (`CLOUDFLARE_ENV=production`) disallows `/app`, `/api`, `/admin`, `/_storybook` and `/health` and lists the sitemap; every other build disallows everything, so staging and develop are never indexed.

## Caching

`apps/web/public/_headers` sets `Cache-Control` for static assets (Workers static assets honour `_headers`; the Astro Cloudflare adapter would add a `/_astro/*` rule, but the file sets one). The file is generated: the cache rules are `STATIC_CACHE_RULES` in `apps/web/src/server/static-cache.ts`, rendered after the security rules by `bun apps/web/scripts/write-static-headers.ts` ([how-to-configure-security-headers.md](how-to-configure-security-headers.md#static-assets)):

| Path                                                                          | Cache-Control                                      | Why                                                                                                                                                          |
| ----------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/_astro/*`                                                                   | `public, max-age=31536000, immutable`              | content-hashed file names                                                                                                                                    |
| `/pagefind/*`                                                                 | `public, max-age=31536000, immutable`              | index chunks and fragments are content-hashed                                                                                                                |
| `/pagefind/pagefind.js`, `/pagefind/pagefind-*` (entry, worker, UI), `wasm.*` | `public, max-age=300`                              | fixed names that change with every build                                                                                                                     |
| `/`, `/docs/*`, `/404`, `/_storybook/`, `/_storybook/iframe` (static HTML)    | `public, max-age=0, must-revalidate, no-transform` | a deploy shows at once; the ETag makes it cheap; the edge may not rewrite the HTML ([why](how-to-configure-security-headers.md#edge-injected-web-analytics)) |
| `/docs/changelog.xml`                                                         | `public, max-age=0, must-revalidate`               | the feed is not HTML                                                                                                                                         |

The rules apply only to responses served from the static assets, not to pages the Worker renders on request (sign-in, `/app`, the API); those get `no-transform` from the middleware. Check them with `curl -I` against `bunx astro preview` (it serves the build like Cloudflare does) or a deployment.

## Bundle budget

`bun run budget` (after `bun run build`; CI runs it in the `build` job) checks the budgets in [performance.md](../architecture/performance.md#targets): each prerendered page loads at most 50 KB gzip of JavaScript on first load (its scripts and their static imports), and each Pagefind file is at most 100 KB gzip. It prints the heaviest pages and files (`scripts/check-bundle-budget.ts`). A page over budget is a regression: drop the dependency, load it lazily, or change the budget with a reason ([performance.md](../architecture/performance.md#regressions-and-budget-changes)).

## Check it locally

```bash
bun run dev:web                     # /docs renders on request in dev
cd apps/web && bun run build:app    # prerenders every page into dist/client/docs/
```

`bun run test:e2e` includes `test/e2e/docs.spec.ts` (landing → docs → a guide, the theme switch, the 404). `bun run test:e2e:build` (after `bun run build`) serves the build with `astro preview` on `APP_URL`'s port and runs `test/e2e-build/`, every test failing on any CSP violation: the landing page (static, its links, the cache header), the search dialog, page metadata, `robots.txt`, and axe on `/`, `/docs/`, a guide and the open search dialog in both themes, and no sideways scrolling at 375 px. The production smoke suite checks `/docs/` and a search on the deployment ([how-to-qa-a-deployment.md](how-to-qa-a-deployment.md)).

## Common problems

### A doc is missing from the site

Its path does not match `DOCS.sources`. Add a glob, or move the file under `docs/`.

### `docs.test.ts` fails with "is in the navigation or exempt with a reason"

Add a row for the doc to [docs/README.md](../README.md), or an entry to `DOCS.exempt` saying why it is not in the navigation.

### Search says "Search could not load"

The page has no index: `astro dev` builds none (use a build and `astro preview`), or `/pagefind/pagefind.js` failed to load (check the network tab and the console: a policy without `'wasm-unsafe-eval'` blocks it).

### `bun run budget` fails

It names the page and its files. A new dependency in a page script, or a component hydrated on a public page (`client:*`), is the usual cause.

### `docs.test.ts` fails with "no heading #… in …"

The heading the link points at was renamed or removed. Point the link at the current heading; ids are the heading text in lower case, spaces as `-`, punctuation dropped.
