/**
 * Mermaid diagrams of the docs site, rendered to inline SVG at build time
 * (`docsDiagramsPlugin` in markdown-plugins.ts runs this on every ```mermaid block). GitHub
 * renders the same block with its own Mermaid, so the Markdown stays the one source and the
 * site's output cannot go stale. The page ships no diagram JavaScript.
 *
 * The SVG comes from beautiful-mermaid (no DOM, no browser) and is made fit for the docs
 * pages here:
 * - no `<style>` element and no `style` attribute: the renderer's own stylesheet imports a
 *   web font from Google, which `font-src 'self'` refuses; its colour variables are set by
 *   packages/ui/src/styles/prose.css from the theme tokens instead, so the diagram follows
 *   the light and dark theme without a re-render;
 * - ids are prefixed per diagram, so several diagrams on one page keep unique ids;
 * - a block becomes a diagram only with Mermaid's `accTitle:` and `accDescr:` lines (GitHub
 *   reads them too): they become the SVG's `<title>` and `<desc>` (`role="img"`), the text
 *   alternative screen readers announce, and the figure's caption. A block without them
 *   stays a code block, and diagrams.test.ts fails for it unless it is in
 *   UNDESCRIBED_DIAGRAMS with a reason.
 * - the SVG keeps its natural size inside a keyboard-scrollable region, so a wide diagram
 *   scrolls on a phone instead of shrinking its text.
 *
 * docs/guides/how-to-publish-docs-and-landing.md#diagrams
 */
import { renderMermaidSVG } from "beautiful-mermaid";

export interface DiagramText {
  /** `accTitle:`: a short name, the caption and the SVG's `<title>`. */
  readonly title: string;
  /** `accDescr:` (one line or a `{ … }` block): what the diagram shows, in prose. */
  readonly description: string;
  /** The diagram without its accessibility lines, for the renderer. */
  readonly body: string;
}

const ACC_TITLE = /^[ \t]*accTitle[ \t]*:[ \t]*(.+?)[ \t]*$/m;
const ACC_DESCR_LINE = /^[ \t]*accDescr[ \t]*:[ \t]*(.+?)[ \t]*$/m;
const ACC_DESCR_BLOCK = /^[ \t]*accDescr[ \t]*\{([\s\S]*?)\}[ \t]*$/m;

/**
 * Files whose ```mermaid blocks may stay code blocks, without a text alternative, each
 * with its reason. Every other block must have one (diagrams.test.ts).
 */
export const UNDESCRIBED_DIAGRAMS: Readonly<Record<string, string>> = {
  "docs/processes/adrs.md":
    "The ADR status diagram; docs/processes/ belongs to the process docs, which add its accTitle and accDescr",
};

/**
 * The accessibility lines of a Mermaid source, and the source without them; null when
 * either is missing.
 */
export function diagramText(source: string): DiagramText | null {
  const title = ACC_TITLE.exec(source)?.[1];
  const block = ACC_DESCR_BLOCK.exec(source);
  const line = ACC_DESCR_LINE.exec(source);
  const description = (block?.[1] ?? line?.[1])?.replace(/\s+/g, " ").trim();
  if (!title || !description) return null;
  const body = source
    .replace(ACC_DESCR_BLOCK, "")
    .replace(ACC_TITLE, "")
    .replace(ACC_DESCR_LINE, "")
    .split("\n")
    .filter((text) => text.trim() !== "")
    .join("\n");
  return { title, description, body };
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The SVG for the docs pages: no stylesheet, no inline style, ids under `prefix`, and
 * `role="img"` named by a `<title>` and described by a `<desc>`.
 */
export function adaptSvg(svg: string, prefix: string, text: DiagramText) {
  const titleId = `${prefix}-title`;
  const descId = `${prefix}-desc`;
  return svg
    .replace(/<style>[\s\S]*?<\/style>\s*/g, "")
    .replace(/\sid="([^"]+)"/g, ` id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(
      /<svg\b([^>]*?)\sstyle="[^"]*"([^>]*)>/,
      (_match, before: string, after: string) =>
        `<svg${before}${after} role="img" aria-labelledby="${titleId} ${descId}" focusable="false" data-diagram-svg="">` +
        `<title id="${titleId}">${escapeHtml(text.title)}</title>` +
        `<desc id="${descId}">${escapeHtml(text.description)}</desc>`
    );
}

/**
 * One ```mermaid block as the figure the docs page shows, or null when it has no text
 * alternative (it then stays a code block). `index` numbers the diagrams of a page
 * (1, 2, …): unique ids and region names.
 */
export function renderDiagram(source: string, index: number): string | null {
  const text = diagramText(source);
  if (!text) return null;
  // The colours are CSS variables that prose.css sets from the theme tokens.
  const svg = renderMermaidSVG(text.body, {
    bg: "var(--diagram-bg)",
    fg: "var(--diagram-fg)",
    transparent: true,
  });
  if (!/<svg\b[^>]*\sstyle="/.test(svg)) {
    throw new Error("beautiful-mermaid's SVG changed shape: check adaptSvg");
  }
  const title = escapeHtml(text.title);
  return [
    `<figure data-diagram="">`,
    `<section data-diagram-scroll="" tabindex="0" aria-label="Diagram ${index}: ${title}">`,
    adaptSvg(svg, `diagram-${index}`, text),
    `</section>`,
    `<figcaption>${title}</figcaption>`,
    `</figure>`,
  ].join("");
}
