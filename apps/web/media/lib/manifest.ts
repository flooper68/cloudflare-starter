/**
 * One manifest entry per recorded video, and the content hash that names its folder in
 * R2 (`media/<hash>/`): the first 12 hex characters of a SHA-256 over every file of the
 * video, in a fixed order. Same files, same hash: an upload of an unchanged video is a
 * no-op, and a changed one gets a new folder, so cached copies never go stale.
 */
import { createHash } from "node:crypto";

import type {
  MediaChapter,
  MediaEntry,
  MediaManifest,
  MediaSource,
} from "../../src/content/media";
import type { VideoKind } from "../../src/content/videos";

export interface VideoFile {
  /** The name in the folder: `<id>.mp4`. */
  readonly name: string;
  readonly bytes: Uint8Array;
}

export function contentHash(files: readonly VideoFile[]): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update(file.name);
    hash.update("\0");
    hash.update(file.bytes);
  }
  return hash.digest("hex").slice(0, 12);
}

const TYPES: Readonly<Record<string, MediaSource["type"]>> = {
  mp4: "video/mp4",
  webm: "video/webm",
};

export function buildEntry(input: {
  readonly id: string;
  readonly title: string;
  readonly kind: VideoKind;
  readonly duration: number;
  readonly width: number;
  readonly height: number;
  readonly chapters: readonly MediaChapter[];
  readonly files: readonly VideoFile[];
  readonly encoder: MediaEntry["encoder"];
}): MediaEntry {
  const hash = contentHash(input.files);
  const path = (name: string) => `/media/${hash}/${name}`;
  const file = (extension: string) =>
    input.files.find((entry) => entry.name === `${input.id}.${extension}`);
  const sources = (["mp4", "webm"] as const).flatMap((extension) => {
    const found = file(extension);
    return found
      ? [
          {
            src: path(found.name),
            type: TYPES[extension] as MediaSource["type"],
            bytes: found.bytes.byteLength,
          },
        ]
      : [];
  });
  const poster = file("jpg");
  if (!poster) throw new Error(`${input.id}: no poster`);
  const captions = file("vtt");
  return {
    id: input.id,
    title: input.title,
    kind: input.kind,
    hash,
    duration: Math.round(input.duration * 10) / 10,
    width: input.width,
    height: input.height,
    audio: false,
    poster: { src: path(poster.name), bytes: poster.bytes.byteLength },
    captions: captions
      ? { src: path(captions.name), bytes: captions.bytes.byteLength }
      : null,
    chapters: input.chapters.map((chapter) => ({
      ...chapter,
      start: Math.round(chapter.start * 10) / 10,
    })),
    sources,
    encoder: input.encoder,
  };
}

/** Merges new entries into the manifest, keeping the ones not recorded this run. */
export function mergeManifest(
  current: MediaManifest,
  entries: readonly MediaEntry[]
): MediaManifest {
  const videos: Record<string, MediaEntry> = { ...current.videos };
  for (const entry of entries) videos[entry.id] = entry;
  const sorted = Object.fromEntries(
    Object.keys(videos)
      .sort()
      .map((id) => [id, videos[id] as MediaEntry])
  );
  return { version: 1, videos: sorted };
}
