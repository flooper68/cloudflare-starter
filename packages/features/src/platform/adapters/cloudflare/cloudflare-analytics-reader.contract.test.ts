import { describe, expect, it } from "vitest";

import { describeAnalyticsReaderContract } from "../../ports/analytics-reader.contract";
import {
  CLOUDFLARE_API,
  createCloudflareAnalyticsReader,
} from "./cloudflare-analytics-reader";

const ACCOUNT = "0123456789abcdef0123456789abcdef";
const TOKEN = "analytics-read-token";

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

/** Answers the SQL and GraphQL APIs the way Cloudflare does; no network. */
function fakeApi(calls: Call[] = [], token = TOKEN) {
  return async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const auth = new Headers(init.headers).get("authorization");
    if (auth !== `Bearer ${token}`)
      return Response.json(
        {
          success: false,
          errors: [{ code: 10000, message: "Authentication error" }],
        },
        { status: 401 }
      );
    if (url === `${CLOUDFLARE_API}/accounts/${ACCOUNT}/analytics_engine/sql`)
      return Response.json({
        meta: [{ name: "one", type: "UInt8" }],
        data: [{ one: 1 }],
        rows: 1,
      });
    if (url === `${CLOUDFLARE_API}/graphql`)
      return Response.json({ data: { viewer: { ok: true } }, errors: null });
    return new Response("not found", { status: 404 });
  };
}

describeAnalyticsReaderContract("cloudflare", () => ({
  reader: createCloudflareAnalyticsReader({
    accountId: ACCOUNT,
    token: TOKEN,
    fetch: fakeApi(),
  }),
  refused: createCloudflareAnalyticsReader({
    accountId: ACCOUNT,
    token: "wrong",
    fetch: fakeApi(),
  }),
}));

describe("cloudflare analytics reader", () => {
  it("posts the statement as the body with the bearer token", async () => {
    const calls: Call[] = [];
    await createCloudflareAnalyticsReader({
      accountId: ACCOUNT,
      token: TOKEN,
      fetch: fakeApi(calls),
    }).sql("SELECT 1 AS one");
    expect(calls[0]?.url).toBe(
      `${CLOUDFLARE_API}/accounts/${ACCOUNT}/analytics_engine/sql`
    );
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.body).toBe("SELECT 1 AS one");
  });

  it("sends GraphQL as JSON with its variables", async () => {
    const calls: Call[] = [];
    await createCloudflareAnalyticsReader({
      accountId: ACCOUNT,
      token: TOKEN,
      fetch: fakeApi(calls),
    }).graphql("query Q($a: string!) { viewer { ok } }", { a: "b" });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      query: "query Q($a: string!) { viewer { ok } }",
      variables: { a: "b" },
    });
  });

  it("reports an API failure as unavailable, with Cloudflare's answer", async () => {
    const reader = createCloudflareAnalyticsReader({
      accountId: ACCOUNT,
      token: TOKEN,
      fetch: async () => new Response("dataset not found", { status: 422 }),
    });
    await expect(reader.sql("SELECT 1")).rejects.toMatchObject({
      reason: "unavailable",
      message: "Cloudflare's analytics API answered 422: dataset not found",
    });
  });

  it("reports a network failure as unavailable and never echoes the token", async () => {
    const reader = createCloudflareAnalyticsReader({
      accountId: ACCOUNT,
      token: TOKEN,
      fetch: async () => {
        throw new Error("connection reset");
      },
    });
    const error = await reader.sql("SELECT 1").catch((caught) => caught);
    expect(error).toMatchObject({ reason: "unavailable" });
    expect(String(error.message)).not.toContain(TOKEN);
  });

  it("reports GraphQL errors as invalid", async () => {
    const reader = createCloudflareAnalyticsReader({
      accountId: ACCOUNT,
      token: TOKEN,
      fetch: async () =>
        Response.json({ data: null, errors: [{ message: "unknown field" }] }),
    });
    await expect(reader.graphql("{ x }", {})).rejects.toMatchObject({
      reason: "invalid",
      message: "GraphQL: unknown field",
    });
  });

  it("refuses an SQL answer without rows", async () => {
    const reader = createCloudflareAnalyticsReader({
      accountId: ACCOUNT,
      token: TOKEN,
      fetch: async () => Response.json({ error: "x" }),
    });
    await expect(reader.sql("SELECT 1")).rejects.toMatchObject({
      reason: "invalid",
    });
  });
});
