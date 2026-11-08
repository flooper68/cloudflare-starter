/**
 * Diagrams in the docs: a paragraph that is only an image of a repository `.svg`
 * (`![The lifecycle](images/agentic-lifecycle.svg)`) is shown on the site as the SVG
 * itself, inlined into the page, instead of an `<img>`. GitHub shows the same file as an
 * image. Inline, the SVG's `<style>` can read the site's tokens (`var(--ui-fg, …)`), so
 * the diagram follows the site's theme switch; as an image on GitHub it falls back to its
 * own colours and `prefers-color-scheme`. The docs pages allow inline styles
 * (`style-src 'unsafe-inline'`), and an SVG never runs script here: one with a
 * `<script>`, an event handler or a `javascript:` URL is refused.
 * Pure, so the Markdown plugin (markdown-plugins.ts) and its test share it.
 * docs/reference/docs-site.md#diagrams
 */
import { parseRepoLink } from "./links";

/** The repository path of the `.svg` an image URL in `from` names, or null. */
export function diagramPath(from: string, url: string): string | null {
  const link = parseRepoLink(from, url);
  if (!link || link.folder || !link.path.toLowerCase().endsWith(".svg"))
    return null;
  return link.path;
}

/**
 * The HTML that replaces the image: the SVG on one line (a blank line would end the
 * Markdown HTML block) in a keyboard-scrollable `<figure>` named by the image's alt
 * text, so a phone can scroll a wide diagram instead of shrinking its text. Throws when
 * the file is not a usable diagram, which fails the build.
 */
export function diagramHtml(path: string, svg: string, alt: string): string {
  const source = svg.replace(/^\s*<\?xml[^>]*\?>/, "").trim();
  const problems: string[] = [];
  if (!source.startsWith("<svg")) problems.push("does not start with <svg>");
  if (!/<title>[^<]+<\/title>/.test(source))
    problems.push("has no <title> (its accessible name)");
  if (/<script|\son[a-z]+\s*=|javascript:/i.test(source))
    problems.push("contains script");
  if (!alt.trim()) problems.push("is linked without alt text");
  if (problems.length > 0)
    throw new Error(`Docs diagram ${path} ${problems.join(", ")}`);
  const oneLine = source.replace(/\s*\n\s*/g, " ");
  const label = alt.trim().replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<figure data-docs-diagram="" tabindex="0" aria-label="${label}">${oneLine}</figure>`;
}
