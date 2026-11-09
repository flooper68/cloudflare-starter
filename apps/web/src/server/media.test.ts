import { describe, expect, it } from "vitest";

import { mediaObject, parseRange, resolveRange } from "./media";

describe("mediaObject", () => {
  it("maps a media path to its R2 key and type", () => {
    expect(mediaObject("0123456789ab/tour.mp4")).toEqual({
      key: "media/0123456789ab/tour.mp4",
      contentType: "video/mp4",
    });
    expect(mediaObject("0123456789ab/tour.vtt")?.contentType).toBe(
      "text/vtt; charset=utf-8"
    );
  });

  it.each([
    "tour.mp4",
    "0123456789ab/../secret.mp4",
    "0123456789ab/tour.html",
    "0123456789ab/Tour.mp4",
    "XYZ456789abc/tour.mp4",
    "0123456789ab/sub/tour.mp4",
  ])("refuses %s", (path) => {
    expect(mediaObject(path)).toBeNull();
  });
});

describe("byte ranges", () => {
  it("parses the single-range forms", () => {
    expect(parseRange(null)).toBeUndefined();
    expect(parseRange("bytes=0-")).toEqual({ offset: 0 });
    expect(parseRange("bytes=100-199")).toEqual({ offset: 100, length: 100 });
    expect(parseRange("bytes=-500")).toEqual({ suffix: 500 });
  });

  it("serves several ranges or another unit as the whole file, and refuses malformed ones", () => {
    expect(parseRange("bytes=0-1, 5-6")).toBeUndefined();
    expect(parseRange("bytes=5-1")).toBe("invalid");
    expect(parseRange("bytes=-")).toBe("invalid");
    expect(parseRange("items=0-1")).toBeUndefined();
    expect(parseRange("bytes=abc")).toBe("invalid");
  });

  it("fits a range into the file", () => {
    expect(resolveRange({ offset: 0 }, 1000)).toEqual({
      start: 0,
      length: 1000,
    });
    expect(resolveRange({ offset: 900, length: 500 }, 1000)).toEqual({
      start: 900,
      length: 100,
    });
    expect(resolveRange({ suffix: 100 }, 1000)).toEqual({
      start: 900,
      length: 100,
    });
    expect(resolveRange({ suffix: 5000 }, 1000)).toEqual({
      start: 0,
      length: 1000,
    });
    expect(resolveRange({ offset: 1000 }, 1000)).toBeNull();
    expect(resolveRange({ suffix: 0 }, 1000)).toBeNull();
  });
});
