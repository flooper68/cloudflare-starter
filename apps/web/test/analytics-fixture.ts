/**
 * A stand-in for Cloudflare's analytics APIs (the Analytics Engine SQL API and the GraphQL
 * Analytics API) for the API tests (test/outbound.ts) and the E2E dev server
 * (test/e2e/analytics-vite.mjs): the admin Analytics page reads canned rows, nothing
 * reaches the network. It answers only the fixture account with the fixture token, like
 * Cloudflare would refuse anything else.
 */
export const ANALYTICS_FIXTURE = {
  accountId: "0123456789abcdef0123456789abcdef",
  token: "fixture-analytics-read-token",
  siteTag: "fedcba9876543210fedcba9876543210",
} as const;

const API = "https://api.cloudflare.com/client/v4";

/** The rows of the people query: three sign-ups, their first tries and a return. */
const PEOPLE = [
  ["ada", "auth.signed_up", "password", 0, "2026-11-07 10:00:00"],
  ["ada", "app.feature_tried", "notes", 0, "2026-11-07 10:03:00"],
  ["ada", "app.feature_tried", "agents", 0, "2026-11-07 10:20:00"],
  ["ada", "app.feature_tried", "command_palette", 0, "2026-11-07 10:40:00"],
  ["ada", "app.session_returned", "", 2, "2026-11-09 08:00:00"],
  ["grace", "auth.signed_up", "social", 0, "2026-11-08 09:00:00"],
  ["grace", "app.feature_tried", "files", 0, "2026-11-08 09:12:00"],
  ["linus", "auth.signed_up", "password", 0, "2026-11-08 17:00:00"],
].map(([person, event, s1, n1, first_at]) => ({
  person,
  event,
  s1,
  n1,
  first_at,
}));

/** The rows of the site query: visits by referrer, interest, clicks, sign-up attempts. */
const SITE = [
  ["site.page_viewed", "home", "yes", "news.ycombinator.com", "", 0, 420],
  ["site.page_viewed", "home", "yes", "", "", 0, 260],
  ["site.page_viewed", "home", "yes", "github.com", "", 0, 140],
  ["site.page_viewed", "docs", "no", "", "", 0, 380],
  ["site.page_scrolled", "home", "", "", "", 25, 610],
  ["site.page_scrolled", "home", "", "", "", 50, 402],
  ["site.page_scrolled", "home", "", "", "", 75, 230],
  ["site.page_scrolled", "home", "", "", "", 100, 118],
  ["site.page_engaged", "home", "scrolled", "", "", 0, 402],
  ["site.page_engaged", "docs", "docs", "", "", 0, 120],
  ["site.cta_clicked", "demo", "hero", "", "", 0, 96],
  ["site.cta_clicked", "github", "hero", "", "", 0, 41],
  ["site.cta_clicked", "copy_prompt", "start", "", "", 0, 22],
  ["site.feature_map_used", "select", "", "", "", 0, 88],
  ["docs.page_viewed", "guides", "", "", "", 0, 210],
  ["docs.page_viewed", "reference", "", "", "", 0, 170],
  ["auth.sign_up_started", "password", "", "", "", 0, 31],
  ["auth.sign_up_failed", "invalid", "", "", "", 0, 6],
  ["auth.sign_up_failed", "bot_check", "", "", "", 0, 2],
].map(([event, s1, s2, s3, s4, n1, total]) => ({
  event,
  s1,
  s2,
  s3,
  s4,
  n1,
  total,
}));

/** The rows of the routes query (metrics dataset). */
const ROUTES = [
  ["/api/trpc/[...trpc]", "200", 5120, 230.4, 1.8],
  ["/api/trpc/[...trpc]", "500", 4, 0.2, 0.1],
  ["/app/[...path]", "200", 830, 49.8, 0.6],
  ["/mcp", "200", 212, 31.8, 2.4],
].map(([route, status, requests, seconds, slowest]) => ({
  route,
  status,
  requests,
  seconds,
  slowest,
}));

/** Cloudflare's answer to an analytics API request, or null when it is not one. */
export async function analyticsFixture(
  request: Request
): Promise<Response | null> {
  if (!request.url.startsWith(`${API}/`)) return null;
  if (
    request.headers.get("authorization") !== `Bearer ${ANALYTICS_FIXTURE.token}`
  ) {
    return Response.json(
      {
        success: false,
        errors: [{ code: 10000, message: "Authentication error" }],
      },
      { status: 403 }
    );
  }
  if (
    request.url ===
    `${API}/accounts/${ANALYTICS_FIXTURE.accountId}/analytics_engine/sql`
  ) {
    const statement = await request.text();
    const data = statement.includes("AS person")
      ? PEOPLE
      : statement.includes("AS route")
        ? ROUTES
        : SITE;
    return Response.json({ meta: [], data, rows: data.length });
  }
  if (request.url === `${API}/graphql`) {
    return Response.json({
      data: {
        viewer: {
          accounts: [
            {
              total: [{ count: 2140, sum: { visits: 905 } }],
              referrers: [
                {
                  sum: { visits: 410 },
                  dimensions: { refererHost: "news.ycombinator.com" },
                },
                {
                  sum: { visits: 150 },
                  dimensions: { refererHost: "github.com" },
                },
              ],
              countries: [
                { sum: { visits: 300 }, dimensions: { countryName: "US" } },
              ],
            },
          ],
        },
      },
      errors: null,
    });
  }
  return new Response("Not found", { status: 404 });
}
