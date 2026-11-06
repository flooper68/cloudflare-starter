/**
 * Sätteri hast plugins of the docs site (astro.config.mjs, `markdown.processor`), run on
 * every Markdown file the site renders:
 * - `docsLinksPlugin` rewrites each link's `href` with `rewriteHref` (links.ts), so links
 *   written for GitHub work on the site. Files outside the repository are left alone.
 * - `docsTablesPlugin` wraps each table in a named, keyboard-scrollable region
 *   (`<section aria-label tabindex=0>`), the markup `Prose` (packages/ui) styles as a
 *   scroll box.
 */
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";

import { rewriteHref } from "./links";

type HastPluginEntry = NonNullable<
  SatteriProcessorOptions["hastPlugins"]
>[number];

/** `repoRoot`: the repository root as a file URL. */
export function docsLinksPlugin(repoRoot: URL): HastPluginEntry {
  const root = fileURLToPath(repoRoot);
  return ({ fileURL }) => {
    if (!fileURL) return null;
    const from = relative(root, fileURLToPath(fileURL)).split(sep).join("/");
    if (from.startsWith("..")) return null;
    return {
      name: "docs-links",
      element: {
        filter: ["a"],
        visit(node, ctx) {
          const href = node.properties?.href;
          if (typeof href !== "string") return;
          const next = rewriteHref(from, href);
          if (next !== href) ctx.setProperty(node, "href", next);
        },
      },
    };
  };
}

export function docsTablesPlugin(): HastPluginEntry {
  return () => {
    // One counter per document: region names must be unique on the page.
    let count = 0;
    return {
      name: "docs-tables",
      element: {
        filter: ["table"],
        visit(node, ctx) {
          count += 1;
          ctx.wrapNode(node, {
            raw: `<section data-table-scroll="" tabindex="0" aria-label="Table ${count}"></section>`,
          });
        },
      },
    };
  };
}
