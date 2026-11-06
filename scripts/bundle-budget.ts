/**
 * The bundle budgets of docs/architecture/performance.md#targets, measured on the build
 * output (`apps/web/dist/client`) by `bun run budget` (check-bundle-budget.ts):
 * - each prerendered page loads at most PAGE_JS_BUDGET bytes of gzip JavaScript on first
 *   load: its same-origin <script src> and <link rel="modulepreload">, plus the static
 *   imports of those modules (dynamic imports load later and are not counted);
 * - each file of the Pagefind index and client is at most PAGEFIND_FILE_BUDGET bytes gzip
 *   (the search dialog loads them lazily, one chunk at a time).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { gzipSync } from "node:zlib";

export const PAGE_JS_BUDGET = 50 * 1024;
export const PAGEFIND_FILE_BUDGET = 100 * 1024;

/**
 * Same-origin script URLs a page loads on first load: <script src>, module preloads and
 * the component and renderer of each hydrated Astro island (`client:*`).
 */
export function pageScripts(html: string): string[] {
  const urls = new Set<string>();
  const collect = (pattern: RegExp) => {
    for (const match of html.matchAll(pattern)) urls.add(match[1]);
  };
  collect(/<script\b[^>]*\bsrc="([^"]+)"/g);
  collect(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g);
  collect(/<astro-island\b[^>]*\bcomponent-url="([^"]+)"/g);
  collect(/<astro-island\b[^>]*\brenderer-url="([^"]+)"/g);
  return [...urls].filter(
    (url) => url.startsWith("/") && !url.startsWith("//")
  );
}

/**
 * Inline <script> elements that run code (not JSON data). The public pages have none:
 * a strict Content-Security-Policy would block them, and they would escape the budget.
 */
export function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(
      ([, attributes, body]) =>
        !/\bsrc=/.test(attributes) &&
        !/\btype="application\/(ld\+)?json"/.test(attributes) &&
        body.trim() !== ""
    )
    .map(([tag]) => tag.slice(0, 80));
}

/** Static imports of a built module (`import x from"./a.js"`, `import"./b.js"`). */
export function staticImports(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(
    /(?:^|[;}\s])(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+\.m?js)["']/g
  ))
    found.add(match[1]);
  return [...found];
}

export const gzipSize = (content: Buffer | string) => gzipSync(content).length;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

export interface PageCost {
  readonly page: string;
  readonly bytes: number;
  readonly files: readonly string[];
  /** Inline scripts that run code (should be none). */
  readonly inline: readonly string[];
}

/** First-load JS (gzip) of every prerendered page under `client` (Storybook aside). */
export function measurePages(client: string): PageCost[] {
  const pages = walk(client).filter(
    (file) =>
      file.endsWith(".html") &&
      !relative(client, file).startsWith("_storybook") &&
      !relative(client, file).startsWith("pagefind")
  );
  return pages.map((page) => {
    const seen = new Set<string>();
    const visit = (url: string) => {
      const file = join(client, url.split(/[?#]/)[0]);
      if (seen.has(file)) return;
      // A script the page loads but the build lacks: measure nothing rather than wrongly.
      if (!existsSync(file))
        throw new Error(
          `${relative(client, page)} loads ${url}, not in the build`
        );
      seen.add(file);
      for (const spec of staticImports(readFileSync(file, "utf8"))) {
        if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
        visit(
          spec.startsWith("/") ? spec : posix.join(posix.dirname(url), spec)
        );
      }
    };
    const html = readFileSync(page, "utf8");
    for (const url of pageScripts(html)) visit(url);
    const files = [...seen];
    return {
      page: `/${relative(client, page)}`,
      bytes: files.reduce((sum, file) => sum + gzipSize(readFileSync(file)), 0),
      files: files.map((file) => `/${relative(client, file)}`),
      inline: inlineScripts(html),
    };
  });
}

/** Gzip size of every Pagefind file. */
export function measurePagefind(
  client: string
): { file: string; bytes: number }[] {
  const dir = join(client, "pagefind");
  if (!existsSync(dir)) return [];
  return walk(dir).map((file) => ({
    file: `/${relative(client, file)}`,
    bytes: gzipSize(readFileSync(file)),
  }));
}

export const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
