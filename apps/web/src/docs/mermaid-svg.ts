/**
 * Docs diagrams written in Mermaid: a `docs/**\/<name>.mmd` file is the source, and
 * `bun apps/web/scripts/render-diagrams.ts` writes `<name>.svg` beside it with
 * beautiful-mermaid (no browser). The `.svg` is an ordinary docs diagram: a Markdown
 * image of it is inlined by the docs pipeline (diagrams.ts) and shown as an image on
 * GitHub. mermaid-svg.test.ts fails while a committed `.svg` differs from its source's
 * output, so a diagram cannot go stale.
 *
 * The output follows the docs diagram rules (docs/reference/docs-site.md#diagrams):
 * - colours from the site tokens (`var(--ui-fg, <fallback>)`), with GitHub fallbacks
 *   for both colour schemes, in a `<style>` scoped to the `dg-mm` class: beautiful-mermaid
 *   paints with `--_*` variables, set here instead of its own stylesheet, which imports a
 *   Google font the docs CSP refuses;
 * - marker ids prefixed with `dg-<name>-`, so several diagrams on a page keep unique ids;
 * - `role="img"` with a `<title>` and a `<desc>` from the source's `accTitle:` and
 *   `accDescr:` lines (Mermaid's own accessibility syntax), required;
 * - `data-natural-width`: the site shows it at its own size, scrolling sideways when the
 *   column is narrower, instead of shrinking its text to fit.
 * Pure, so the script and the test share it.
 */
import { renderMermaidSVG } from "beautiful-mermaid";

export interface DiagramText {
  /** `accTitle:`: a short name, the SVG's `<title>`. */
  readonly title: string;
  /** `accDescr:` (one line or a `{ … }` block): what the diagram shows, in prose. */
  readonly description: string;
  /** The diagram without its accessibility lines, for the renderer. */
  readonly body: string;
}

const ACC_TITLE = /^[ \t]*accTitle[ \t]*:[ \t]*(.+?)[ \t]*$/m;
const ACC_DESCR_LINE = /^[ \t]*accDescr[ \t]*:[ \t]*(.+?)[ \t]*$/m;
const ACC_DESCR_BLOCK = /^[ \t]*accDescr[ \t]*\{([\s\S]*?)\}[ \t]*$/m;

/** The accessibility lines of a Mermaid source and the source without them. */
export function diagramText(source: string): DiagramText {
  const title = ACC_TITLE.exec(source)?.[1];
  const block = ACC_DESCR_BLOCK.exec(source);
  const description = (block?.[1] ?? ACC_DESCR_LINE.exec(source)?.[1])
    ?.replace(/\s+/g, " ")
    .trim();
  if (!title || !description) {
    throw new Error(
      "A Mermaid diagram needs an accTitle: and an accDescr: line, its text alternative"
    );
  }
  const body = source
    .replace(ACC_DESCR_BLOCK, "")
    .replace(ACC_TITLE, "")
    .replace(ACC_DESCR_LINE, "")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
  return { title, description, body };
}

const SANS =
  'var(--brand-font-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif)';

/**
 * beautiful-mermaid's colour variables, from the site tokens with GitHub's colours as
 * fallbacks. Text uses the readable foreground tokens, never a faded mix.
 */
function palette(scheme: "light" | "dark"): string {
  const light = scheme === "light";
  const token = (name: string, lightValue: string, darkValue: string) =>
    `var(--ui-${name}, ${light ? lightValue : darkValue})`;
  return [
    `--_text:${token("fg", "#1f2328", "#f0f6fc")}`,
    `--_text-sec:${token("fg-muted", "#59636e", "#9198a1")}`,
    `--_text-muted:${token("fg-muted", "#59636e", "#9198a1")}`,
    `--_text-faint:${token("fg-subtle", "#59636e", "#9198a1")}`,
    `--_line:${token("fg-subtle", "#818b98", "#8b949e")}`,
    `--_arrow:${token("fg-muted", "#59636e", "#9198a1")}`,
    `--_node-fill:${token("surface", "#f6f8fa", "#161b22")}`,
    `--_node-stroke:${token("line-strong", "#d0d7de", "#3d444d")}`,
    `--_group-fill:${token("surface-raised", "#ffffff", "#0d1117")}`,
    `--_group-hdr:${token("hover", "#eff2f5", "#1c2128")}`,
    `--_inner-stroke:${token("line", "#d8dee4", "#30363d")}`,
    `--_key-badge:${token("active", "#e6eaef", "#262c36")}`,
    `--bg:${token("surface-raised", "#ffffff", "#0d1117")}`,
    `--fg:${token("fg", "#1f2328", "#f0f6fc")}`,
  ].join(";");
}

const STYLE = [
  "<style>",
  `.dg-mm{${palette("light")}}`,
  `.dg-mm .dg-mm-bg{fill:var(--bg)}`,
  `.dg-mm text{font-family:${SANS}}`,
  `@media (prefers-color-scheme:dark){.dg-mm{${palette("dark")}}}`,
  "</style>",
].join("");

const escapeXml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The standalone SVG of one `.mmd` source. `name`: the file name without `.mmd`. */
export function mermaidToSvg(source: string, name: string): string {
  const text = diagramText(source);
  const svg = renderMermaidSVG(text.body, { bg: "#fff", fg: "#000" });
  const open = /^<svg\b([^>]*)>/.exec(svg);
  const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!open || !viewBox) {
    throw new Error(
      "beautiful-mermaid's SVG changed shape: check mermaidToSvg"
    );
  }
  const width = Math.ceil(Number(viewBox[1]));
  const height = Math.ceil(Number(viewBox[2]));
  const prefix = `dg-${name}-`;
  const body = svg
    .slice(open[0].length)
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/\sid="([^"]+)"/g, ` id="${prefix}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="dg-mm" viewBox="0 0 ${viewBox[1]} ${viewBox[2]}" width="${width}" height="${height}" role="img" data-natural-width="">`,
    `<title>${escapeXml(text.title)}</title>`,
    `<desc>${escapeXml(text.description)}</desc>`,
    STYLE,
    `<rect class="dg-mm-bg" x="0" y="0" width="${viewBox[1]}" height="${viewBox[2]}" rx="12"/>`,
    body,
  ].join("\n");
}
