/**
 * Sätteri plugins of the docs site (astro.config.mjs, `markdown.processor`), run on
 * every Markdown file the site renders:
 * - `docsDiagramsPlugin` (mdast) inlines a paragraph that is only an image of a
 *   repository `.svg` as the SVG itself (diagrams.ts), before Astro collects images.
 * - `docsLinksPlugin` rewrites each link's `href` with `rewriteHref` (links.ts), so links
 *   written for GitHub work on the site. Files outside the repository are left alone.
 * - `docsTablesPlugin` wraps each table in a named, keyboard-scrollable region
 *   (`<section aria-label tabindex=0>`), the markup `Prose` (packages/ui) styles as a
 *   scroll box.
 * - `docsTaskListsPlugin` hides the disabled checkboxes of `- [ ]` checklists from
 *   assistive technology: they are decoration that cannot be ticked, the item's text says
 *   it all, and an unlabelled form control fails axe's `label` rule.
 */
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";

import { diagramHtml, diagramPath } from "./diagrams";
import { rewriteHref } from "./links";

type HastPluginEntry = NonNullable<
  SatteriProcessorOptions["hastPlugins"]
>[number];
type MdastPluginEntry = NonNullable<
  SatteriProcessorOptions["mdastPlugins"]
>[number];

/** `repoRoot`: the repository root as a file URL. */
export function docsDiagramsPlugin(repoRoot: URL): MdastPluginEntry {
  const root = fileURLToPath(repoRoot);
  return ({ fileURL }) => {
    if (!fileURL) return null;
    const from = relative(root, fileURLToPath(fileURL)).split(sep).join("/");
    if (from.startsWith("..")) return null;
    return {
      name: "docs-diagrams",
      paragraph(node, ctx) {
        if (node.children.length !== 1) return;
        const [image] = node.children;
        if (image.type !== "image") return;
        const path = diagramPath(from, image.url);
        if (!path) return;
        const svg = readFileSync(join(root, path), "utf8");
        ctx.replaceNode(node, {
          raw: diagramHtml(path, svg, image.alt ?? ""),
          mdxExpressions: false,
        });
      },
    };
  };
}

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

export function docsTaskListsPlugin(): HastPluginEntry {
  return () => ({
    name: "docs-task-lists",
    element: {
      filter: ["input"],
      visit(node, ctx) {
        if (node.properties?.type !== "checkbox" || !node.properties.disabled)
          return;
        ctx.setProperty(node, "ariaHidden", "true");
      },
    },
  });
}
