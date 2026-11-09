import { fileURLToPath } from "node:url";

// The E2E dev server's Cloudflare analytics APIs (playwright.config.ts sets the Node-only
// E2E_LOCAL_ANALYTICS=1): the admin Analytics page reads the canned answers of
// test/analytics-fixture.ts with its token and account, so its journey and screenshots
// need no Cloudflare account. Like turnstile-vite.mjs, it refuses builds and
// non-development modes; never configure it as a Worker variable.
const fixturePath = fileURLToPath(
  new URL("../analytics-fixture.ts", import.meta.url)
);
const rawInjection = "  const raw = buildRawEnv(env);";
const fetchInjection = "fetch: (input, init) => fetch(input, init),";

export function localAnalyticsPlugins(enabled) {
  if (!enabled) return [];
  return [
    {
      name: "e2e-local-analytics",
      enforce: "pre",
      apply(_config, environment) {
        if (
          environment.command !== "serve" ||
          environment.mode !== "development"
        ) {
          throw new Error(
            "E2E_LOCAL_ANALYTICS is only allowed in the development test server"
          );
        }
        return true;
      },
      transform(code, id) {
        if (
          !id.split("?")[0].endsWith("/apps/web/src/server/analytics-read.ts")
        ) {
          return null;
        }
        if (
          code.split(rawInjection).length !== 2 ||
          code.split(fetchInjection).length !== 2
        ) {
          throw new Error(
            "The E2E analytics injection points in src/server/analytics-read.ts changed; review test/e2e/analytics-vite.mjs"
          );
        }
        return {
          code:
            `import { ANALYTICS_FIXTURE as e2eFixture, analyticsFixture as e2eAnalytics } from ${JSON.stringify(fixturePath)};\n` +
            code
              .replace(
                rawInjection,
                "  const raw = { ...buildRawEnv(env), ANALYTICS_READ_TOKEN: e2eFixture.token, ANALYTICS_ACCOUNT_ID: e2eFixture.accountId, WEB_ANALYTICS_SITE_TAG: e2eFixture.siteTag };"
              )
              .replace(
                fetchInjection,
                "fetch: async (input, init) => (await e2eAnalytics(new Request(input, init))) ?? new Response(null, { status: 502 }),"
              ),
          map: null,
        };
      },
    },
  ];
}
