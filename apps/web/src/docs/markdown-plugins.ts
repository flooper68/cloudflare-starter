/**
 * Sätteri hast plugins of the docs site (astro.config.mjs, `markdown.processor`), run on
 * every Markdown file the site renders:
 * - `docsLinksPlugin` rewrites each link's `href` with `rewriteHref` (links.ts), so links
 *   written for GitHub work on the site. Files outside the repository are left alone.
 * - `docsTablesPlugin` wraps each table in a named, keyboard-scrollable region
 *   (`<section aria-label tabindex=0>`), the markup `Prose` (packages/ui) styles as a
 *   scroll box.
 * - `docsTaskListsPlugin` hides the disabled checkboxes of `- [ ]` checklists from
 *   assistive technology: they are decoration that cannot be ticked, the item's text says
 *   it all, and an unlabelled form control fails axe's `label` rule.
 * - `docsDiagramsPlugin` replaces each ```mermaid block that has a text alternative with
 *   its inline SVG (diagrams.ts), rendered here at build time. astro.config.mjs keeps
 *   Shiki off mermaid blocks, so one without stays a plain code block.
 */
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";

import { renderDiagram } from "./diagrams";
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

export function docsDiagramsPlugin(): HastPluginEntry {
  return () => {
    // One counter per document: ids and region names must be unique on the page.
    let count = 0;
    return {
      name: "docs-diagrams",
      element: {
        filter: ["pre"],
        visit(node, ctx) {
          const code = node.children.find(
            (child) => child.type === "element" && child.tagName === "code"
          );
          if (code?.type !== "element") return;
          const classes = code.properties?.className;
          if (!Array.isArray(classes) || !classes.includes("language-mermaid"))
            return;
          const figure = renderDiagram(ctx.textContent(code), count + 1);
          if (figure === null) return;
          count += 1;
          ctx.replaceNode(node, { type: "raw", value: figure });
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
