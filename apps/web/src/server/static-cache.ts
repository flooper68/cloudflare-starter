/**
 * Cache-Control of static assets, rendered into `public/_headers` with the security
 * rules (security-headers.ts `renderStaticHeaders`, one block per path). The Astro
 * Cloudflare adapter adds its own immutable rule for `/_astro/*` at build time.
 * docs/guides/how-to-publish-docs-and-landing.md#caching
 */

const REVALIDATE = "public, max-age=0, must-revalidate";
const IMMUTABLE = "public, max-age=31536000, immutable";
const FIVE_MINUTES = "public, max-age=300";

export interface StaticCacheRule {
  readonly path: string;
  readonly cacheControl: string;
  /** Replaces the value an earlier, broader rule set (`! Cache-Control`). */
  readonly replaces?: boolean;
  readonly why: string;
}

export const STATIC_CACHE_RULES: readonly StaticCacheRule[] = [
  {
    path: "/docs/*",
    cacheControl: REVALIDATE,
    why: "prerendered pages: a deploy shows at once; the ETag keeps revalidation cheap",
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
