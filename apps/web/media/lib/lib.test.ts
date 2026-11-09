import { describe, expect, it } from "vitest";

import type { MediaManifest } from "../../src/content/media";
import { buildEntry, contentHash, mergeManifest } from "./manifest";
import { filesBucket, uploadPlan } from "./upload-plan";
import { captionsVtt, vttTime } from "./vtt";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("captionsVtt", () => {
  it("formats times", () => {
    expect(vttTime(0)).toBe("00:00:00.000");
    expect(vttTime(75.5)).toBe("00:01:15.500");
    expect(vttTime(3723.004)).toBe("01:02:03.004");
  });

  it("writes one cue per step, each until the next step or the end", () => {
    const vtt = captionsVtt(
      [
        { start: 8, title: "Two", caption: "Then <this> & --> that." },
        { start: 0, title: "One", caption: "First." },
      ],
      12
    );
    expect(vtt).toBe(
      [
        "WEBVTT",
        "",
        "1",
        "00:00:00.000 --> 00:00:08.000",
        "First.",
        "",
        "2",
        "00:00:08.000 --> 00:00:12.000",
        "Then &lt;this> &amp; → that.",
        "",
      ].join("\n")
    );
  });
});

describe("manifest entries", () => {
  const files = [
    { name: "tour.mp4", bytes: bytes("mp4") },
    { name: "tour.webm", bytes: bytes("webm!") },
    { name: "tour.jpg", bytes: bytes("jpg") },
    { name: "tour.vtt", bytes: bytes("WEBVTT") },
  ];

  it("hashes the files, whatever their order, and changes with any byte", () => {
    const hash = contentHash(files);
    expect(hash).toMatch(/^[0-9a-f]{12}$/);
    expect(contentHash([...files].reverse())).toBe(hash);
    expect(
      contentHash([
        ...files.slice(1),
        { name: "tour.mp4", bytes: bytes("mp5") },
      ])
    ).not.toBe(hash);
  });

  it("puts every file under /media/<hash>/ with its size, MP4 first", () => {
    const entry = buildEntry({
      id: "tour",
      title: "The starter in 90 seconds",
      kind: "walkthrough",
      duration: 90.04,
      width: 1440,
      height: 900,
      chapters: [{ start: 8.04, title: "Two", caption: "Second." }],
      files,
      encoder: "ffmpeg",
    });
    const base = `/media/${entry.hash}/tour`;
    expect(entry.sources).toEqual([
      { src: `${base}.mp4`, type: "video/mp4", bytes: 3 },
      { src: `${base}.webm`, type: "video/webm", bytes: 5 },
    ]);
    expect(entry.poster).toEqual({ src: `${base}.jpg`, bytes: 3 });
    expect(entry.captions).toEqual({ src: `${base}.vtt`, bytes: 6 });
    expect(entry.duration).toBe(90);
    expect(entry.chapters[0]?.start).toBe(8);
  });

  it("keeps the entries not recorded in this run, sorted by id", () => {
    const old = { version: 1, videos: { b: {}, a: {} } };
    const next = mergeManifest(old as unknown as MediaManifest, []);
    expect(Object.keys(next.videos)).toEqual(["a", "b"]);
  });
});

describe("uploadPlan", () => {
  const entry = buildEntry({
    id: "loop-x",
    title: "X",
    kind: "loop",
    duration: 6,
    width: 960,
    height: 600,
    chapters: [],
    files: [
      { name: "loop-x.mp4", bytes: bytes("1") },
      { name: "loop-x.webm", bytes: bytes("2") },
      { name: "loop-x.jpg", bytes: bytes("3") },
    ],
    encoder: "ffmpeg",
  });
  const manifest: MediaManifest = {
    version: 1,
    videos: { "loop-x": entry },
  };

  it("uploads the media under media/<hash>/, the JSON marker last", () => {
    const [folder] = uploadPlan(manifest);
    expect(folder?.objects.map((object) => object.key)).toEqual([
      `media/${entry.hash}/loop-x.mp4`,
      `media/${entry.hash}/loop-x.webm`,
      `media/${entry.hash}/loop-x.jpg`,
      `media/${entry.hash}/loop-x.json`,
    ]);
    expect(folder?.marker).toBe(`media/${entry.hash}/loop-x.json`);
    expect(folder?.objects[0]?.contentType).toBe("video/mp4");
  });

  it("finds each environment's FILES bucket", () => {
    const config = {
      r2_buckets: [{ binding: "FILES", bucket_name: "files-develop" }],
      env: {
        production: {
          r2_buckets: [{ binding: "FILES", bucket_name: "files-production" }],
        },
      },
    };
    expect(filesBucket(config, "local")).toBe("files-develop");
    expect(filesBucket(config, "develop")).toBe("files-develop");
    expect(filesBucket(config, "production")).toBe("files-production");
    expect(() => filesBucket(config, "staging")).toThrow(/staging/);
  });
});
