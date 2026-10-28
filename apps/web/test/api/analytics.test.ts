/**
 * Product analytics through the real handlers: `analytics.track` (client batches) and the
 * server events of sign-up, workspace creation and file upload. Events go to the
 * ANALYTICS_EVENTS dataset of wrangler.jsonc (Miniflare's simulation stores nothing); the
 * test records every data point on its way there, like mailEnv records mail, and decodes
 * it with the adapter's own layout.
 */
import {
  analyticsEvents,
  decodeAnalyticsEngineDataPoint,
  IDENTIFY_EVENT,
  IDENTIFY_TRAITS_LAYOUT,
  pseudonymousId,
  RATE_LIMIT_POLICIES,
} from "@cloudflare-starter/features";
import type { APIContext } from "astro";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as uploadRoute } from "@/pages/api/files/index";
import { POST as trpcRoute } from "@/pages/api/trpc/[...trpc]";

import { API_TEST_BINDINGS } from "../api-bindings";
import {
  APP_URL,
  callerFor,
  env,
  expectCrossWorkspaceDenied,
  signUp,
  type TestUser,
  testRequestContext,
} from "./helpers";

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

/** The recorded points, decoded with the catalog's layout of each event. */
function decoded() {
  return points.map((point) => {
    const event = String(point.blobs?.[0]);
    return decodeAnalyticsEngineDataPoint(
      point,
      event === IDENTIFY_EVENT
        ? IDENTIFY_TRAITS_LAYOUT
        : analyticsEvents.get(event)?.layout
    );
  });
}

const key = (id: string) =>
  pseudonymousId(API_TEST_BINDINGS.ANALYTICS_ID_SECRET, id);

const page = (route: string) => ({
  event: "app.page_viewed",
  properties: { route },
});

describe("analytics.track", () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await signUp("Nicole Example", "nicole@example.test");
  });

  it("refuses anonymous callers", async () => {
    await expect(
      callerFor(null).analytics.track({ events: [page("/app/dashboard")] })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(points).toEqual([]);
  });

  it("refuses a server-only or unknown event with 400, tracking nothing of the batch", async () => {
    for (const event of ["files.uploaded", "app.unknown"]) {
      await expect(
        callerFor(user).analytics.track({
          events: [page("/app/dashboard"), { event, properties: {} }],
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(
      callerFor(user).analytics.track({
        events: [page("https://example.test/app?email=a@b.test")],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      callerFor(user).analytics.track({
        events: Array.from({ length: 21 }, () => page("/app")),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(points).toEqual([]);
  });

  it("records a batch under the user's and workspace's pseudonyms", async () => {
    const { activeWorkspaceId } = await callerFor(user).workspace.list();
    expect(
      await callerFor(user).analytics.track({
        events: [page("/app/dashboard"), page("/app/members")],
      })
    ).toEqual({ tracked: 2 });
    expect(decoded()).toEqual([
      {
        event: "app.page_viewed",
        user: key(user.id),
        workspace: key(activeWorkspaceId as string),
        environment: "develop",
        release: "local",
        source: "http",
        properties: { route: "/app/dashboard" },
      },
      expect.objectContaining({ properties: { route: "/app/members" } }),
    ]);
    expect(JSON.stringify(points)).not.toContain(user.id);
  });

  it("is a workspace procedure", async () => {
    await expectCrossWorkspaceDenied("analytics.track", {
      events: [page("/app/dashboard")],
    });
  });

  it("answers over analytics.client with 429, Retry-After and the RateLimit fields", async () => {
    const counted = await signUp("Rita Limit", "rita@example.test");
    const { limit, periodSeconds } = RATE_LIMIT_POLICIES["analytics.client"];
    const send = () =>
      trpcRoute({
        request: new Request(`${APP_URL}/api/trpc/analytics.track`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-trpc-source": "app",
            "cf-connecting-ip": "192.0.2.40",
          },
          body: JSON.stringify({ events: [page("/app/dashboard")] }),
        }),
        url: new URL(`${APP_URL}/api/trpc/analytics.track`),
        params: {},
        locals: {
          user: { id: counted.id, email: counted.email, name: counted.name },
          requestContext: { ...testRequestContext(), ip: "192.0.2.40" },
        },
      } as unknown as APIContext);
    let refused: Response | undefined;
    let call = 0;
    while (!refused && call <= limit * 2) {
      call += 1;
      const response = await send();
      if (response.status === 429) refused = response;
      else expect(response.status).toBe(200);
    }
    expect(call).toBeGreaterThan(limit);
    expect(refused?.headers.get("retry-after")).toBe(String(periodSeconds));
    expect(refused?.headers.get("ratelimit-policy")).toBe(
      `"analytics.client";q=${limit};w=${periodSeconds}`
    );
    expect(refused?.headers.get("ratelimit")).toBe(
      `"analytics.client";r=0;t=${periodSeconds}`
    );
    // Telemetry has its own budget: the user's mutations still go through.
    await expect(
      callerFor(counted).workspace.create({ name: "Still allowed" })
    ).resolves.toMatchObject({ name: "Still allowed" });
  });
});

describe("server events", () => {
  it("sign-up: auth.signed_up, the personal workspace and the user's traits", async () => {
    const ada = await signUp("Ada Lovelace", "ada@example.test");
    const { activeWorkspaceId } = await callerFor(ada).workspace.list();
    expect(
      decoded().map((point) => [
        point.event,
        point.user,
        point.workspace,
        point.properties,
      ])
    ).toEqual([
      [
        "workspaces.created",
        key(ada.id),
        key(activeWorkspaceId as string),
        { kind: "personal" },
      ],
      [
        "$identify",
        key(ada.id),
        key(activeWorkspaceId as string),
        { role: "owner", workspace_size: "1", plan: null },
      ],
      [
        "auth.signed_up",
        key(ada.id),
        null,
        { method: "password", provider: null },
      ],
    ]);
  });

  it("workspace.create: workspaces.created (shared) and the owner's traits", async () => {
    const grace = await signUp("Grace Hopper", "grace@example.test");
    points.length = 0;
    const team = await callerFor(grace).workspace.create({ name: "Acme" });
    expect(
      decoded().map((point) => [point.event, point.workspace, point.properties])
    ).toEqual([
      ["workspaces.created", key(team.id), { kind: "shared" }],
      [
        "$identify",
        key(team.id),
        { role: "owner", workspace_size: "1", plan: null },
      ],
    ]);
  });

  it("POST /api/files: files.uploaded with category and size, never the filename", async () => {
    const alan = await signUp("Alan Turing", "alan@example.test");
    points.length = 0;
    const form = new FormData();
    form.set(
      "file",
      new File(["Q4 roadmap"], "salaries-2026.txt", { type: "text/plain" })
    );
    const request = new Request(`${APP_URL}/api/files`, {
      method: "POST",
      body: form,
      headers: { origin: APP_URL, "cf-connecting-ip": "192.0.2.41" },
    });
    const response = await uploadRoute({
      request,
      url: new URL(request.url),
      params: {},
      locals: {
        user: { id: alan.id, email: alan.email, name: alan.name },
        requestContext: testRequestContext(),
      },
    } as unknown as APIContext);
    expect(response.status).toBe(201);
    expect(
      decoded().map((point) => [point.event, point.user, point.properties])
    ).toEqual([
      [
        "files.uploaded",
        key(alan.id),
        { content_category: "text", size_bytes: 10 },
      ],
    ]);
    expect(JSON.stringify(points)).not.toContain("salaries");
  });
});
