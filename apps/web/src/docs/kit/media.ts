/**
 * The walkthrough videos the docs can play, as `docs/media/media-manifest.json`. The
 * video recording pipeline writes it (a separate change, not on main yet); until a video
 * is in it, `::video{id="…"}` shows a designed poster with "Video coming soon".
 *
 * The contract both sides keep:
 * - `::video{id="agents" poster="<screenshot id>" title="…"}` in a doc; `id` is the
 *   video's id in the recording plan (tour, agents, accounts, …).
 * - The manifest: `{ "version": 1, "videos": { "<id>": { "src", "poster"?, "captions"?,
 *   "chapters"?, "title"?, "duration"? } } }`, URLs as the site serves them.
 */
import type { MediaEntry } from "./render";

export const MEDIA_MANIFEST = "docs/media/media-manifest.json";

export interface MediaManifest {
  readonly version: 1;
  readonly videos: Readonly<Record<string, MediaEntry>>;
}

export const EMPTY_MEDIA: MediaManifest = { version: 1, videos: {} };

export function isVideoId(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}
