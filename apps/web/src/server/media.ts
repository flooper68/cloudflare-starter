/**
 * The walkthrough videos, posters and captions, served from R2 at `/media/<hash>/<file>`
 * (R2 key `media/<hash>/<file>`). `bun run media:upload` puts them there; the hash in the
 * path is the content hash of one video's files (src/content/media-manifest.json), so a
 * response never changes and is cached for a year. Same origin, so the pages'
 * `media-src 'self'` and `img-src 'self'` already allow it. Single byte ranges are
 * answered with 206 (video seeking needs them). Nothing here reads a session.
 * docs/guides/how-to-record-walkthrough-videos.md
 */

/** The URL prefix and the R2 key prefix. */
export const MEDIA_PATH = "/media/";
export const MEDIA_KEY_PREFIX = "media/";

export const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";
/** A missing file may appear after the next upload: cached briefly. */
const MISSING_CACHE_CONTROL = "public, max-age=60";

/** The file types the recorder writes, by extension. Anything else is a 404. */
export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  mp4: "video/mp4",
  webm: "video/webm",
  vtt: "text/vtt; charset=utf-8",
  jpg: "image/jpeg",
  json: "application/json",
};

const MEDIA_FILE =
  /^([0-9a-f]{12,64})\/([a-z0-9][a-z0-9-]{0,63})\.([a-z0-9]+)$/;

/** The R2 key and content type of a path under /media/, or null when it is not one. */
export function mediaObject(
  path: string
): { readonly key: string; readonly contentType: string } | null {
  const match = MEDIA_FILE.exec(path);
  if (!match) return null;
  const contentType = MEDIA_TYPES[match[3] as string];
  if (!contentType) return null;
  return { key: `${MEDIA_KEY_PREFIX}${path}`, contentType };
}

export type ByteRange =
  | { readonly offset: number; readonly length?: number }
  | { readonly suffix: number };

/**
 * A `Range` header as an R2 range: one `bytes=` range (`a-b`, `a-` or `-n`). Undefined
 * without the header or for a form we do not serve (several ranges, other units), which
 * gets the whole file, as RFC 9110 allows. "invalid" for a range that is malformed.
 */
export function parseRange(
  header: string | null
): ByteRange | "invalid" | undefined {
  if (!header) return undefined;
  const value = header.trim();
  // RFC 9110: a unit we do not know, or several ranges, get the whole file.
  if (!value.startsWith("bytes=") || value.includes(",")) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return "invalid";
  const [, start, end] = match as unknown as [string, string, string];
  if (start === "" && end === "") return "invalid";
  if (start === "") return { suffix: Number(end) };
  const offset = Number(start);
  if (end === "") return { offset };
  const last = Number(end);
  if (last < offset) return "invalid";
  return { offset, length: last - offset + 1 };
}

/** The first byte and the length of a range within a file of `size` bytes, or null. */
export function resolveRange(
  range: ByteRange,
  size: number
): { readonly start: number; readonly length: number } | null {
  if ("suffix" in range) {
    if (range.suffix === 0 || size === 0) return null;
    const length = Math.min(range.suffix, size);
    return { start: size - length, length };
  }
  if (range.offset >= size) return null;
  const length = Math.min(
    range.length ?? size - range.offset,
    size - range.offset
  );
  return { start: range.offset, length };
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": MISSING_CACHE_CONTROL,
    },
  });
}

/** Answers GET or HEAD for `path` (after `/media/`) from the bucket. */
export async function mediaResponse(
  bucket: R2Bucket,
  request: Request,
  path: string
): Promise<Response> {
  const target = mediaObject(path);
  if (!target) return notFound();
  const head = request.method === "HEAD";
  const parsed = parseRange(request.headers.get("range"));

  const object = await bucket.head(target.key);
  if (!object) return notFound();

  const headers = new Headers({
    "Content-Type": target.contentType,
    "Cache-Control": MEDIA_CACHE_CONTROL,
    "Accept-Ranges": "bytes",
    ETag: object.httpEtag,
  });

  const ifNoneMatch = request.headers.get("if-none-match") ?? "";
  if (ifNoneMatch.split(",").some((tag) => tag.trim() === object.httpEtag)) {
    return new Response(null, { status: 304, headers });
  }

  const range =
    parsed && parsed !== "invalid"
      ? resolveRange(parsed, object.size)
      : undefined;
  if (parsed === "invalid" || range === null) {
    headers.set("Content-Range", `bytes */${object.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (range) {
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.start + range.length - 1}/${object.size}`
    );
    headers.set("Content-Length", String(range.length));
    if (head) return new Response(null, { status: 206, headers });
    const body = await bucket.get(target.key, {
      range: { offset: range.start, length: range.length },
    });
    if (!body) return notFound();
    return new Response(body.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(object.size));
  if (head) return new Response(null, { status: 200, headers });
  const body = await bucket.get(target.key);
  if (!body) return notFound();
  return new Response(body.body, { status: 200, headers });
}
