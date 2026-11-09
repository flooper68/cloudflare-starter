/**
 * POST /api/site-events through the middleware and the real handler: anonymous site
 * events of the catalog are written to the ANALYTICS_EVENTS dataset with no user, no
 * workspace and no cookie read; anything else is refused; automated browsers are not
 * counted; the endpoint is limited per IP by site.events.
 */
import {
  analyticsEvents,
  decodeAnalyticsEngineDataPoint,
  RATE_LIMIT_POLICIES,
} from "@cloudflare-starter/features";
import type { APIContext } from "astro";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as siteEventsRoute } from "@/pages/api/site-events";
import {
  handleAppRequest,
  type MiddlewareContext,
} from "@/server/app-middleware";

import { APP_URL, env, signUp } from "./helpers";

const points: AnalyticsEngineDataPoint[] = [];

beforeAll(() => {
  const dataset = env.ANALYTICS_EVENTS as AnalyticsEngineDataset;
  const write = dataset.writeDataPoint.bind(dataset);
  dataset.writeDataPoint = (point) => {
    points.push(point ?? {});
    write(point);
  };
});
beforeEach(() => {
  points.length = 0;
});

const decoded = () =>
  points.map((point) =>
    decodeAnalyticsEngineDataPoint(
      point,
      analyticsEvents.get(String(point.blobs?.[0]))?.layout
    )
  );

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function beacon(
  ip: string,
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request(`${APP_URL}/api/site-events`, {
    method: "POST",
    headers: {
      "content-type": "text/plain;charset=UTF-8",
      origin: APP_URL,
      "sec-fetch-site": "same-origin",
      "user-agent": BROWSER,
      "cf-connecting-ip": ip,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Runs a request through the middleware and the route, as Astro does. */
async function serve(request: Request): Promise<Response> {
  const context: MiddlewareContext = {
    request,
    url: new URL(request.url),
    isPrerendered: false,
    locals: {} as MiddlewareContext["locals"],
    redirect: (path: string, status = 302) =>
      Response.redirect(new URL(path, request.url), status as 302),
    routePattern: "/api/site-events",
  };
  return handleAppRequest(context, env, async () =>
    siteEventsRoute({
      request,
      url: context.url,
      params: {},
      locals: context.locals,
    } as unknown as APIContext)
  );
}

const view = {
  event: "site.page_viewed",
  properties: {
    page: "home",
    entry: "yes",
    referrer_host: "news.ycombinator.com",
    utm_source: "",
  },
};
const click = {
  event: "site.cta_clicked",
  properties: { cta: "demo", placement: "hero" },
};

describe("POST /api/site-events", () => {
  it("writes a batch anonymously and answers 204", async () => {
    const response = await serve(
      beacon("198.51.100.81", { events: [view, click] })
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("ratelimit-policy")).toContain("site.events");
    expect(decoded()).toEqual([
      expect.objectContaining({
        event: "site.page_viewed",
        user: null,
        workspace: null,
        // The adapter stores '' and reads it back as null.
        properties: { ...view.properties, utm_source: null },
      }),
      expect.objectContaining({
        event: "site.cta_clicked",
        user: null,
        workspace: null,
        properties: click.properties,
      }),
    ]);
  });

  it("never reads the session: a signed-in visitor's events stay anonymous", async () => {
    const ada = await signUp("Ada Site", "ada-site@example.test");
    points.length = 0;
    const response = await serve(
      beacon("198.51.100.82", { events: [click] }, { cookie: ada.cookie ?? "" })
    );
    expect(response.status).toBe(204);
    expect(decoded()).toEqual([
      expect.objectContaining({ event: "site.cta_clicked", user: null }),
    ]);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    [
      "an app event",
      { events: [{ event: "app.page_viewed", properties: { route: "/app" } }] },
    ],
    [
      "a server event",
      {
        events: [
          {
            event: "auth.signed_up",
            properties: { method: "password", provider: null },
          },
        ],
      },
    ],
    [
      "free text as an id",
      {
        events: [
          {
            event: "site.cta_clicked",
            properties: { cta: "Try it now!", placement: "hero" },
          },
        ],
      },
    ],
    [
      "a URL as the referrer",
      {
        events: [
          {
            ...view,
            properties: {
              ...view.properties,
              referrer_host: "https://x.test/?email=a@b.test",
            },
          },
        ],
      },
    ],
    ["no events", { events: [] }],
    ["eleven events", { events: Array.from({ length: 11 }, () => click) }],
  ])("refuses %s with 400 and writes nothing", async (_, body) => {
    expect((await serve(beacon("198.51.100.83", body))).status).toBe(400);
    expect(points).toEqual([]);
  });

  it("refuses another site, other media types, oversized and malformed bodies", async () => {
    const body = { events: [click] };
    expect(
      (
        await serve(
          beacon("198.51.100.84", body, {
            origin: "https://evil.example",
            "sec-fetch-site": "cross-site",
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await serve(
          beacon("198.51.100.84", body, {
            "content-type": "application/x-www-form-urlencoded",
          })
        )
      ).status
    ).toBe(415);
    expect(
      (
        await serve(
          beacon("198.51.100.84", JSON.stringify(body) + " ".repeat(9 * 1024))
        )
      ).status
    ).toBe(413);
    expect((await serve(beacon("198.51.100.84", "not json"))).status).toBe(400);
    expect(points).toEqual([]);
  });

  it.each([
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0 Safari/537.36",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "curl/8.7.1",
  ])("answers %s with 204 and does not count it", async (agent) => {
    const response = await serve(
      beacon("198.51.100.85", { events: [click] }, { "user-agent": agent })
    );
    expect(response.status).toBe(204);
    expect(points).toEqual([]);
  });

  it("is limited per IP by site.events", async () => {
    const { limit } = RATE_LIMIT_POLICIES["site.events"];
    let last: Response | undefined;
    for (let attempt = 0; attempt < limit * 2 + 1; attempt += 1) {
      last = await serve(beacon("198.51.100.86", { events: [click] }));
      if (last.status === 429) break;
      expect(last.status).toBe(204);
    }
    expect(last?.status).toBe(429);
    expect(last?.headers.get("retry-after")).toBeTruthy();
  });
});
