/**
 * Cache-Control of static assets, rendered into `public/_headers` with the security
 * rules (security-headers.ts `renderStaticHeaders`, one block per path). The Astro
 * Cloudflare adapter adds its own immutable rule for `/_astro/*` at build time.
 * Every static HTML file also gets `no-transform` (cache-control.ts): the Cloudflare
 * edge then injects no Web Analytics beacon the page policy would block.
 * docs/guides/how-to-publish-docs-and-landing.md#caching
 */

import { withNoTransform } from "./cache-control";

/** Also what Workers Static Assets sends on an asset no rule names. */
const REVALIDATE = "public, max-age=0, must-revalidate";
const HTML_REVALIDATE = withNoTransform(REVALIDATE);
const IMMUTABLE = "public, max-age=31536000, immutable";
const FIVE_MINUTES = "public, max-age=300";

export interface StaticCacheRule {
  readonly path: string;
  readonly cacheControl: string;
  /** Replaces the value an earlier, broader rule set (`! Cache-Control`). */
  readonly replaces?: boolean;
  readonly why: string;
}

/**
 * The static files that are HTML, by path as Workers Static Assets serves them (it
 * drops `.html` and `index.html`): each gets `no-transform`. `/docs/*` also matches the
 * Atom feed, which a rule below gives back its plain value.
 */
export const STATIC_HTML_PATHS = [
  "/",
  "/docs/*",
  "/404",
  "/404.html",
  "/_storybook/",
  "/_storybook/iframe",
] as const;

export const STATIC_CACHE_RULES: readonly StaticCacheRule[] = [
  {
    path: "/",
    cacheControl: HTML_REVALIDATE,
    why: "the prerendered landing page: a deploy shows at once; HTML the edge must not rewrite",
  },
  {
    path: "/docs/*",
    cacheControl: HTML_REVALIDATE,
    why: "prerendered pages: a deploy shows at once; the ETag keeps revalidation cheap; HTML the edge must not rewrite",
  },
  {
    path: "/docs/changelog.xml",
    cacheControl: REVALIDATE,
    replaces: true,
    why: "the Atom feed is not HTML: the edge may compress it",
  },
  {
    path: "/404",
    cacheControl: HTML_REVALIDATE,
    why: "the prerendered 404 the Worker answers unknown paths with: the assets' default caching, HTML the edge must not rewrite",
  },
  {
    path: "/404.html",
    cacheControl: HTML_REVALIDATE,
    why: "the prerendered 404 the Worker answers unknown paths with: the assets' default caching, HTML the edge must not rewrite",
  },
  {
    path: "/_storybook/",
    cacheControl: HTML_REVALIDATE,
    why: "Storybook's manager page (index.html): the assets' default caching, HTML the edge must not rewrite",
  },
  {
    path: "/_storybook/iframe",
    cacheControl: HTML_REVALIDATE,
    why: "Storybook's preview page (iframe.html, served without .html): the assets' default caching, HTML the edge must not rewrite",
  },
  {
    path: "/pagefind/*",
    cacheControl: IMMUTABLE,
    why: "Pagefind index chunks and fragments are content-hashed",
  },
  {
    path: "/pagefind/pagefind.js",
    cacheControl: FIVE_MINUTES,
    replaces: true,
    why: "Pagefind files with fixed names change with a build",
  },
  {
    path: "/pagefind/pagefind-*",
    cacheControl: FIVE_MINUTES,
    replaces: true,
    why: "the entry, worker and UI files have fixed names",
  },
  {
    path: "/pagefind/wasm.*",
    cacheControl: FIVE_MINUTES,
    replaces: true,
    why: "the WebAssembly files have fixed names",
  },
];
