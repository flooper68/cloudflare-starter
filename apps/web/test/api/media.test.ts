/**
 * /media/<hash>/<file>: the walkthrough videos from the FILES bucket, with the app's real
 * binding. Whole files and byte ranges (video seeking), conditional requests, immutable
 * caching, the type from the extension, a 404 for anything missing or outside media/,
 * and the middleware: no session lookup, the non-HTML policy.
 */
import { env as workerEnv } from "cloudflare:workers";
import type { APIContext } from "astro";
import { beforeAll, describe, expect, it } from "vitest";

import { GET, HEAD } from "@/pages/media/[...path]";
import {
  handleAppRequest,
  type MiddlewareContext,
} from "@/server/app-middleware";
import type { AppEnv } from "@/server/env";
import { MEDIA_CACHE_CONTROL } from "@/server/media";

import { APP_URL, testRequestContext } from "./helpers";

const env = workerEnv as AppEnv;
const HASH = "0123456789ab";
const BODY = new Uint8Array(1000).map((_, index) => index % 251);

function call(
  path: string,
  headers: Record<string, string> = {},
  method: "GET" | "HEAD" = "GET"
) {
  const request = new Request(`${APP_URL}/media/${path}`, { method, headers });
  const context = {
    request,
    url: new URL(request.url),
    params: { path },
    locals: { user: null, requestContext: testRequestContext() },
  } as unknown as APIContext;
  return (method === "GET" ? GET : HEAD)(context);
}

beforeAll(async () => {
  await env.FILES.put(`media/${HASH}/tour.mp4`, BODY);
  await env.FILES.put(`media/${HASH}/tour.vtt`, "WEBVTT\n");
  await env.FILES.put("workspaces/w1/uploads/2026/11/secret.mp4", BODY);
});

describe("media route", () => {
  it("serves a whole file with its type and a year of immutable caching", async () => {
    const response = await call(`${HASH}/tour.mp4`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("cache-control")).toBe(MEDIA_CACHE_CONTROL);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("1000");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BODY);
    const captions = await call(`${HASH}/tour.vtt`);
    expect(captions.headers.get("content-type")).toBe(
      "text/vtt; charset=utf-8"
    );
  });

  it("answers a byte range with 206 and Content-Range", async () => {
    const response = await call(`${HASH}/tour.mp4`, { range: "bytes=100-199" });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 100-199/1000");
    expect(response.headers.get("content-length")).toBe("100");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      BODY.slice(100, 200)
    );

    const tail = await call(`${HASH}/tour.mp4`, { range: "bytes=-10" });
    expect(tail.headers.get("content-range")).toBe("bytes 990-999/1000");
    expect(new Uint8Array(await tail.arrayBuffer())).toEqual(BODY.slice(990));

    const open = await call(`${HASH}/tour.mp4`, { range: "bytes=900-" });
    expect(open.headers.get("content-range")).toBe("bytes 900-999/1000");
  });

  it("refuses a range outside the file with 416", async () => {
    const response = await call(`${HASH}/tour.mp4`, { range: "bytes=5000-" });
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */1000");
  });

  it("answers HEAD and If-None-Match without a body", async () => {
    const head = await call(`${HASH}/tour.mp4`, {}, "HEAD");
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("1000");
    expect(head.body).toBeNull();
    const etag = head.headers.get("etag") as string;
    const cached = await call(`${HASH}/tour.mp4`, { "if-none-match": etag });
    expect(cached.status).toBe(304);
  });

  it("is a 404 for a missing file, another type or a key outside media/", async () => {
    for (const path of [
      `${HASH}/agents.mp4`,
      `${HASH}/tour.html`,
      "../workspaces/w1/uploads/2026/11/secret.mp4",
      "workspaces/w1/uploads/2026/11/secret.mp4",
    ]) {
      const response = await call(path);
      expect(response.status, path).toBe(404);
      expect(response.headers.get("cache-control"), path).toBe(
        "public, max-age=60"
      );
    }
  });

  it("is served by the middleware without a session, under the non-HTML policy", async () => {
    const request = new Request(`${APP_URL}/media/${HASH}/tour.mp4`, {
      headers: { cookie: "better-auth.session_token=not-a-session" },
    });
    const context = {
      request,
      url: new URL(request.url),
      isPrerendered: false,
      locals: {},
      redirect: () => new Response(null, { status: 302 }),
    } as unknown as MiddlewareContext;
    const response = await handleAppRequest(context, env, async () =>
      call(`${HASH}/tour.mp4`)
    );
    expect(response.status).toBe(200);
    expect((context.locals as { user?: unknown }).user ?? null).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'"
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
