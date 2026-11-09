/**
 * The recorded walkthrough videos: `media-manifest.json`, written by `bun run
 * media:record` and committed (the media itself is in R2, never in git). Each entry
 * names its files under `/media/<hash>/`, served by the Worker from R2
 * (src/server/media.ts). Plain data and pure helpers: the player, the docs plugin, tests
 * and the recorder import it. docs/guides/how-to-record-walkthrough-videos.md
 */
import manifest from "./media-manifest.json" with { type: "json" };
import type { VideoKind } from "./videos";

export interface MediaChapter {
  /** Seconds from the start. */
  readonly start: number;
  readonly title: string;
  /** The caption shown during the chapter (the transcript line). */
  readonly caption: string;
}

export interface MediaSource {
  /** Site path: `/media/<hash>/<id>.mp4`. */
  readonly src: string;
  readonly type: "video/mp4" | "video/webm";
  readonly bytes: number;
}

export interface MediaEntry {
  readonly id: string;
  readonly title: string;
  readonly kind: VideoKind;
  /** The first 12 hex characters of the SHA-256 of the video's files: its folder. */
  readonly hash: string;
  /** Seconds. */
  readonly duration: number;
  readonly width: number;
  readonly height: number;
  /** Whether the video has a sound track (the recordings have none). */
  readonly audio: boolean;
  readonly poster: { readonly src: string; readonly bytes: number };
  /** Captions (WebVTT); walkthroughs only. */
  readonly captions: { readonly src: string; readonly bytes: number } | null;
  readonly chapters: readonly MediaChapter[];
  /** Best first: MP4 (H.264), then WebM. */
  readonly sources: readonly MediaSource[];
  /** `ffmpeg`: MP4 and WebM, trimmed. `playwright`: only Playwright's own WebM. */
  readonly encoder: "ffmpeg" | "playwright";
}

export interface MediaManifest {
  readonly version: 1;
  readonly videos: Readonly<Record<string, MediaEntry>>;
}

export const MEDIA_MANIFEST = manifest as MediaManifest;

export function mediaEntry(id: string): MediaEntry | undefined {
  return MEDIA_MANIFEST.videos[id];
}

/** `75` → `1:15`. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** `75` → `1 minute 15 seconds`, for labels read aloud. */
export function spokenDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  const parts = [
    minutes ? `${minutes} minute${minutes === 1 ? "" : "s"}` : "",
    rest || !minutes ? `${rest} second${rest === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}
