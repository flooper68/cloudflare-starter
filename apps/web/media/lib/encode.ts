/**
 * Turns Playwright's recording (VP8 WebM, with the lead-in before step 1) into the files
 * the site serves. With ffmpeg (a dev requirement for full output): the lead-in and tail
 * are cut, and the video is encoded as H.264 MP4 (played first, everywhere) and VP9
 * WebM, without sound; loops are scaled to 960 px wide. Without ffmpeg: Playwright's WebM
 * as it is (lead-in included, the captions shifted to match), and the run says so.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync } from "node:fs";

import type { VideoKind } from "../../src/content/videos";

export function hasFfmpeg(): boolean {
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  const ffprobe = spawnSync("ffprobe", ["-version"], { stdio: "ignore" });
  return ffmpeg.status === 0 && ffprobe.status === 0;
}

function run(command: string, args: readonly string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`${command} failed:\n${result.stderr.slice(-2000)}`);
  return result.stdout;
}

/** Seconds, from ffprobe. */
export function probeDuration(file: string): number {
  return Number(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]).trim()
  );
}

/** Output width for a kind; height keeps the aspect ratio. */
export function outputWidth(kind: VideoKind, recorded: number): number {
  return kind === "loop" ? Math.min(960, recorded) : recorded;
}

export interface EncodeInput {
  readonly raw: string;
  readonly kind: VideoKind;
  /** Seconds to cut from the start (the lead-in) and the length to keep. */
  readonly start: number;
  readonly length: number;
  readonly width: number;
  readonly mp4: string;
  readonly webm: string;
}

export function encodeWithFfmpeg(input: EncodeInput): void {
  const { raw, start, length, width } = input;
  const cut = ["-ss", start.toFixed(3), "-i", raw, "-t", length.toFixed(3)];
  const scale = ["-vf", `scale=${width}:-2:flags=lanczos`];
  run("ffmpeg", [
    "-y",
    "-v",
    "error",
    ...cut,
    ...scale,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    input.kind === "loop" ? "27" : "25",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    input.mp4,
  ]);
  run("ffmpeg", [
    "-y",
    "-v",
    "error",
    ...cut,
    ...scale,
    "-an",
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    input.kind === "loop" ? "40" : "38",
    "-row-mt",
    "1",
    "-deadline",
    "good",
    "-cpu-used",
    "4",
    input.webm,
  ]);
}

/** A screenshot (PNG) as the poster JPEG, scaled to the video's width. */
export function posterWithFfmpeg(
  png: string,
  jpg: string,
  width: number
): void {
  run("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    png,
    "-vf",
    `scale=${width}:-2:flags=lanczos`,
    "-q:v",
    "4",
    jpg,
  ]);
}

/** Without ffmpeg: Playwright's own WebM is the only source. */
export function keepPlaywrightWebm(raw: string, webm: string): void {
  copyFileSync(raw, webm);
}
