/**
 * `bun run media:record [--only <id>[,<id>…]] [--require-ffmpeg]`
 *
 * Records the feature walkthrough videos with Playwright against a local `astro dev` on
 * its own seeded state (media/lib/server.ts, media/lib/seed.ts), one script per video
 * (media/videos/), and writes for each: MP4 (H.264) and WebM, a poster JPEG, captions
 * (WebVTT, walkthroughs only) and a JSON entry, under apps/web/tmp/media/out/<hash>/
 * (gitignored). Then it updates src/content/media-manifest.json, the one committed file.
 * Without ffmpeg it keeps Playwright's WebM only, and says so; in CI (or with
 * --require-ffmpeg) it stops instead.
 * Next: `bun run media:upload --env <env>`.
 * docs/guides/how-to-record-walkthrough-videos.md
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { type Browser, chromium, type Page } from "@playwright/test";

import { devPort } from "../dev-port.mjs";
import type { MediaEntry, MediaManifest } from "../src/content/media";
import { formatDuration } from "../src/content/media";
import { VIDEOS } from "../src/content/videos";
import { DemoAgent } from "./lib/agent";
import { Director } from "./lib/director";
import {
  encodeWithFfmpeg,
  hasFfmpeg,
  keepPlaywrightWebm,
  outputWidth,
  posterWithFfmpeg,
  probeDuration,
} from "./lib/encode";
import { buildEntry, mergeManifest, type VideoFile } from "./lib/manifest";
import { installOverlay } from "./lib/overlay";
import { type SeedResult, seed } from "./lib/seed";
import { copyState, freshState, startDevServer } from "./lib/server";
import { captionsVtt } from "./lib/vtt";
import { SCRIPTS } from "./videos";
import type { VideoScript } from "./videos/types";

const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const WORK = join(APP_DIR, "tmp/media");
const SEED_STATE = join(WORK, "state-seed");
const RUN_STATE = join(WORK, "state-run");
const RAW = join(WORK, "raw");
const OUT = join(WORK, "out");
export const MANIFEST_PATH = join(APP_DIR, "src/content/media-manifest.json");
// A normal desktop Chrome: the consent record and Connected agents show the browser.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
const TURNSTILE_WIDGET = readFileSync(
  join(APP_DIR, "test/e2e/turnstile-widget.js"),
  "utf8"
);

const { values } = parseArgs({
  options: {
    only: { type: "string", multiple: true },
    "require-ffmpeg": { type: "boolean", default: false },
  },
});
const only = (values.only ?? []).flatMap((value) => value.split(","));
const unknown = only.filter((id) => !SCRIPTS.some((s) => s.id === id));
if (unknown.length > 0) {
  console.error(
    `No recorder script for: ${unknown.join(", ")}. Scripted: ${SCRIPTS.map((s) => s.id).join(", ")}`
  );
  process.exit(1);
}
const selected = only.length
  ? SCRIPTS.filter((s) => only.includes(s.id))
  : SCRIPTS;

async function stubTurnstile(page: Page) {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: TURNSTILE_WIDGET,
      })
  );
}

/** Opens each page once, so astro dev has compiled it before the camera rolls. */
async function warmUp(browser: Browser, baseURL: string, state: string) {
  const context = await browser.newContext({ baseURL, storageState: state });
  const page = await context.newPage();
  await stubTurnstile(page);
  for (const path of [
    "/",
    "/sign-in",
    "/app/dashboard",
    "/app/notes",
    "/app/members",
    "/app/billing",
    "/app/settings/connected-agents",
    "/app/settings/privacy",
    "/admin/overview",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  await context.close();
}

interface Recorded {
  readonly raw: string;
  readonly director: Director;
}

async function recordOne(
  browser: Browser,
  baseURL: string,
  script: VideoScript,
  seeded: SeedResult
): Promise<Recorded> {
  const viewport = script.viewport ?? { width: 1440, height: 900 };
  const dir = join(RAW, script.id);
  rmSync(dir, { recursive: true, force: true });
  const context = await browser.newContext({
    baseURL,
    viewport,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    userAgent: USER_AGENT,
    storageState: script.signedIn ? seeded.adaState : undefined,
    recordVideo: { dir, size: viewport },
  });
  await context.addInitScript(installOverlay);
  const page = await context.newPage();
  const director = new Director(page, Date.now());
  await stubTurnstile(page);
  await script.record({
    d: director,
    page,
    baseURL,
    seed: seeded,
    agent: () => new DemoAgent(page.request, baseURL),
  });
  if (!director.posterPng) await director.poster();
  const video = page.video();
  await context.close();
  if (!video) throw new Error(`${script.id}: no video`);
  return { raw: await video.path(), director };
}

function finish(
  script: VideoScript,
  recorded: Recorded,
  ffmpeg: boolean
): MediaEntry {
  const meta = VIDEOS.find((video) => video.id === script.id);
  if (!meta) throw new Error(`${script.id} is not in src/content/videos.ts`);
  const { director } = recorded;
  const viewport = script.viewport ?? { width: 1440, height: 900 };
  const width = ffmpeg
    ? outputWidth(meta.kind, viewport.width)
    : viewport.width;
  const height = Math.round((viewport.height * width) / viewport.width / 2) * 2;
  const scratch = join(WORK, "encode", script.id);
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  const at = (name: string) => join(scratch, name);
  const posterPng = at("poster.png");
  writeFileSync(posterPng, director.posterPng as Buffer);

  const leadIn = ffmpeg ? director.leadIn() : 0;
  const end = director.ended ?? director.now();
  let duration = end - director.leadIn();
  const names: string[] = [];
  if (ffmpeg) {
    encodeWithFfmpeg({
      raw: recorded.raw,
      kind: meta.kind,
      start: director.leadIn(),
      length: duration,
      width,
      mp4: at(`${script.id}.mp4`),
      webm: at(`${script.id}.webm`),
    });
    posterWithFfmpeg(posterPng, at(`${script.id}.jpg`), width);
    duration = probeDuration(at(`${script.id}.mp4`));
    names.push(`${script.id}.mp4`, `${script.id}.webm`, `${script.id}.jpg`);
  } else {
    keepPlaywrightWebm(recorded.raw, at(`${script.id}.webm`));
    // No scaling without ffmpeg: Playwright's own JPEG at the recorded size.
    writeFileSync(at(`${script.id}.jpg`), director.posterJpg as Buffer);
    duration = end;
    names.push(`${script.id}.webm`, `${script.id}.jpg`);
  }

  const chapters = director.marks.map((mark) => ({
    start: Math.max(0, mark.at - leadIn),
    title: mark.title,
    caption: mark.caption,
  }));
  if (meta.kind === "walkthrough") {
    writeFileSync(at(`${script.id}.vtt`), captionsVtt(chapters, duration));
    names.push(`${script.id}.vtt`);
  }
  const files: VideoFile[] = names.map((name) => ({
    name,
    bytes: readFileSync(at(name)),
  }));
  const entry = buildEntry({
    id: script.id,
    title: meta.title,
    kind: meta.kind,
    duration,
    width,
    height,
    chapters: meta.kind === "walkthrough" ? chapters : [],
    files,
    encoder: ffmpeg ? "ffmpeg" : "playwright",
  });
  const folder = join(OUT, entry.hash);
  mkdirSync(folder, { recursive: true });
  for (const file of files) writeFileSync(join(folder, file.name), file.bytes);
  writeFileSync(
    join(folder, `${script.id}.json`),
    `${JSON.stringify(entry, null, 2)}\n`
  );
  return entry;
}

async function main() {
  const ffmpeg = hasFfmpeg();
  if (!ffmpeg && (values["require-ffmpeg"] || process.env.CI)) {
    console.error(
      "ffmpeg and ffprobe are required here (CI or --require-ffmpeg): without them there is no MP4, which Safari needs."
    );
    process.exit(1);
  }
  console.log(
    ffmpeg
      ? "ffmpeg found: MP4 (H.264) and WebM, trimmed."
      : "ffmpeg not found: WebM only (Playwright's own, untrimmed). Install ffmpeg for MP4 (docs/guides/how-to-record-walkthrough-videos.md)."
  );
  const port = devPort();
  mkdirSync(WORK, { recursive: true });
  const browser = await chromium.launch();
  const entries: MediaEntry[] = [];
  const warnings: string[] = [];
  const failed: string[] = [];
  try {
    console.log("Seeding a fresh local state…");
    freshState(APP_DIR, SEED_STATE);
    let server = await startDevServer({
      appDir: APP_DIR,
      stateDir: SEED_STATE,
      port,
    });
    let seeded: SeedResult;
    try {
      seeded = await seed({
        browser,
        baseURL: server.baseURL,
        appDir: APP_DIR,
        stateDir: SEED_STATE,
        stub: stubTurnstile,
      });
    } finally {
      await server.stop();
    }

    for (const script of selected) {
      console.log(`Recording ${script.id}…`);
      copyState(SEED_STATE, RUN_STATE);
      server = await startDevServer({
        appDir: APP_DIR,
        stateDir: RUN_STATE,
        port,
      });
      try {
        let recorded: Recorded;
        try {
          await warmUp(browser, server.baseURL, seeded.adaState);
          recorded = await recordOne(browser, server.baseURL, script, seeded);
        } finally {
          await server.stop();
        }
        warnings.push(
          ...recorded.director.late.map((late) => `${script.id}: ${late}`)
        );
        const entry = finish(script, recorded, ffmpeg);
        entries.push(entry);
        // Written after each video, while no server runs: a later failure keeps it.
        writeManifest([entry]);
      } catch (error) {
        failed.push(script.id);
        console.error(`  ${script.id} failed: ${error}`);
      }
    }
  } finally {
    await browser.close();
  }

  const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
  console.log("\nRecorded (apps/web/tmp/media/out/<hash>/):");
  for (const entry of entries) {
    const sizes = entry.sources
      .map((source) => `${source.type.split("/")[1]} ${kb(source.bytes)}`)
      .join(", ");
    console.log(
      `  ${entry.id.padEnd(16)} ${formatDuration(entry.duration).padStart(5)}  ${entry.hash}  ${sizes}, poster ${kb(entry.poster.bytes)}`
    );
  }
  for (const warning of warnings) console.warn(`  late step: ${warning}`);
  console.log(
    "\nUpdated src/content/media-manifest.json. Next: bun run media:upload --env <env>"
  );
  if (failed.length > 0) {
    console.error(
      `\nNot recorded: ${failed.join(", ")}. Fix and run again with --only ${failed.join(",")}.`
    );
    process.exit(1);
  }
}

function writeManifest(entries: readonly MediaEntry[]) {
  const current = JSON.parse(
    readFileSync(MANIFEST_PATH, "utf8")
  ) as MediaManifest;
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify(mergeManifest(current, entries), null, 2)}\n`
  );
}

await main();
