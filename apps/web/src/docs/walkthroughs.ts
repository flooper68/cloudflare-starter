/**
 * Which videos a doc shows: its `::video{id="…"}` directives (the docs kit, kit/plugin.ts),
 * outside fenced code blocks. A doc whose video is recorded loads the player's script
 * (pages/docs/[...slug].astro). Pure, so the page and the tests share it.
 * docs/guides/how-to-record-walkthrough-videos.md#in-the-docs
 */
import { mediaEntry } from "../content/media";

const VIDEO = /^\s*::video\{[^}]*\bid="([^"]+)"/;

/** The ids of a doc's `::video` directives, outside fenced code blocks. */
export function videoIds(markdown: string): string[] {
  const ids: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const opener = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (opener) {
      if (fence === null) fence = opener[0] as string;
      else if (opener[0] === fence) fence = null;
      continue;
    }
    const id = fence === null ? VIDEO.exec(line)?.[1] : undefined;
    if (id) ids.push(id);
  }
  return ids;
}

/** Whether a doc shows a recorded video (its page then loads the player's script). */
export function hasRecordedVideo(markdown: string): boolean {
  return videoIds(markdown).some((id) => mediaEntry(id) !== undefined);
}
