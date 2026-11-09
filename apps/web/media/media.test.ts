/**
 * The walkthrough videos agree everywhere: the recorder's scripts, the catalogue
 * (src/content/videos.ts), the committed manifest, the home page's slots and the docs'
 * `::video{id="…"}` directives.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { MEDIA_MANIFEST } from "../src/content/media";
import { HOME_CLIPS, HOME_WALKTHROUGH, VIDEOS } from "../src/content/videos";
import { videoIds } from "../src/docs/walkthroughs";
import { SCRIPTS } from "./videos";

const scripted = VIDEOS.filter((video) => video.status === "scripted").map(
  (video) => video.id
);
const scriptIds = SCRIPTS.map((script) => script.id);
const ROOT = resolve(import.meta.dirname, "../../..");

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith(".md") ? [path] : [];
  });
}

describe("walkthrough videos", () => {
  it("has one recorder script per scripted video, and no other", () => {
    expect([...scriptIds].sort()).toEqual([...scripted].sort());
    expect(new Set(scriptIds).size).toBe(scriptIds.length);
  });

  it("has unique ids in the catalogue", () => {
    const ids = VIDEOS.map((video) => video.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names a follow-up for every planned video", () => {
    for (const video of VIDEOS.filter((entry) => entry.status === "planned")) {
      expect(video.followUp, video.id).toBeTruthy();
    }
  });

  it("lists only recorder scripts in the manifest, with the catalogue's title and kind", () => {
    for (const [id, entry] of Object.entries(MEDIA_MANIFEST.videos)) {
      expect(scriptIds, `manifest entry ${id}`).toContain(id);
      expect(entry.id).toBe(id);
      const meta = VIDEOS.find((video) => video.id === id);
      expect(entry.title).toBe(meta?.title);
      expect(entry.kind).toBe(meta?.kind);
      for (const src of [
        entry.poster.src,
        ...entry.sources.map((source) => source.src),
        ...(entry.captions ? [entry.captions.src] : []),
      ]) {
        expect(src).toMatch(new RegExp(`^/media/${entry.hash}/${id}\\.`));
      }
    }
  });

  it("gives walkthroughs captions and chapters, and loops neither", () => {
    for (const entry of Object.values(MEDIA_MANIFEST.videos)) {
      if (entry.kind === "walkthrough") {
        expect(entry.captions, entry.id).not.toBeNull();
        expect(entry.chapters.length, entry.id).toBeGreaterThan(1);
        // 30–90 s, with half a second for the encoder's rounding.
        expect(entry.duration, entry.id).toBeGreaterThanOrEqual(29.5);
        expect(entry.duration, entry.id).toBeLessThanOrEqual(90.5);
      } else {
        expect(entry.captions, entry.id).toBeNull();
        // 6–10 s, with half a second for the encoder's rounding.
        expect(entry.duration, entry.id).toBeGreaterThanOrEqual(5.5);
        expect(entry.duration, entry.id).toBeLessThanOrEqual(10.5);
      }
    }
  });

  it("fills the home page's slots with recorded videos of the right kind", () => {
    for (const id of Object.values(HOME_CLIPS)) {
      expect(scriptIds, `home clip ${id}`).toContain(id);
      expect(MEDIA_MANIFEST.videos[id]?.kind, id).toBe("loop");
    }
    if (HOME_WALKTHROUGH) {
      expect(scriptIds).toContain(HOME_WALKTHROUGH);
      expect(MEDIA_MANIFEST.videos[HOME_WALKTHROUGH]?.kind).toBe("walkthrough");
    }
  });

  it("names only catalogued videos in the docs' ::video directives", () => {
    const markers = markdownFiles(join(ROOT, "docs")).flatMap((file) =>
      videoIds(readFileSync(file, "utf8")).map((id) => [file, id] as const)
    );
    // A project that stripped the starter's videos keeps the directives as posters.
    if (VIDEOS.length === 0) return;
    expect(markers.length).toBeGreaterThan(0);
    for (const [file, id] of markers) {
      expect(
        VIDEOS.map((video) => video.id),
        `${file}: walkthrough ${id}`
      ).toContain(id);
    }
  });
});
