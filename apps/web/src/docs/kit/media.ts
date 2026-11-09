/**
 * The walkthrough videos the docs can play: the one media manifest the home page uses too,
 * `apps/web/src/content/media-manifest.json`, written by `bun run media:record`
 * (docs/guides/how-to-record-walkthrough-videos.md). Until a video is in it,
 * `::video{id="…"}` shows its poster screenshot with "Video coming soon".
 *
 * - `::video{id="agents" poster="<screenshot id>" title="…"}` in a doc; `id` is a video
 *   of `VIDEOS` (src/content/videos.ts), `poster` and `title` serve the coming-soon state.
 * - A recorded video renders the walkthrough player (components/media/player-markup.ts),
 *   with the manifest's title, chapters and captions.
 */
import type { MediaManifest } from "../../content/media";

export type { MediaEntry, MediaManifest } from "../../content/media";

/** The manifest, from the repository root (the plugin reads it per document). */
export const MEDIA_MANIFEST = "apps/web/src/content/media-manifest.json";

export const EMPTY_MEDIA: MediaManifest = { version: 1, videos: {} };

export function isVideoId(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}
