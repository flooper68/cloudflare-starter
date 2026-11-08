/**
 * Walkthrough videos in the docs: a line that is only `<!-- walkthrough: agents -->` (an
 * HTML comment, so GitHub shows nothing) becomes the video player on the site, from the
 * media manifest (src/content/media.ts). A recorded video renders the player; one not
 * recorded yet renders its "coming soon" poster; an id that is not a video fails the
 * build. Pure, so the Markdown plugin (markdown-plugins.ts) and its test share it.
 * docs/guides/how-to-record-walkthrough-videos.md#in-the-docs
 */
import { playerHtml } from "../components/media/player-markup";
import { mediaEntry } from "../content/media";
import { video } from "../content/videos";

const MARKER = /^<!--\s*walkthrough:\s*([a-z0-9-]+)\s*-->$/;

/** The video id of a Markdown HTML block, or null when it is not a marker. */
export function walkthroughId(html: string): string | null {
  return MARKER.exec(html.trim())?.[1] ?? null;
}

/** Whether a doc has a marker (its page then loads the player's script). */
export function hasWalkthrough(markdown: string): boolean {
  return markdown.split("\n").some((line) => walkthroughId(line) !== null);
}

/** The player's HTML for a marker's id; throws (failing the build) for an unknown id. */
export function walkthroughHtml(id: string, from: string): string {
  const meta = video(id);
  if (!meta)
    throw new Error(
      `${from}: <!-- walkthrough: ${id} --> names no video in src/content/videos.ts`
    );
  return `<div class="docs-walkthrough not-prose">${playerHtml(mediaEntry(id), meta.title)}</div>`;
}
