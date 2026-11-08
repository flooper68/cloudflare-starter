// The demo-mode E2E server (playwright.config.ts, project "demo"): a second `astro dev`
// started with the Node-only E2E_DEMO_PORT=<port>, which turns demo mode on and moves
// APP_URL to that port for that server only. The journeys' own server keeps
// DEMO_MODE=off from .dev.vars. Like turnstile-vite.mjs, it refuses builds and
// non-development modes; never configure it as a Worker variable.
const injection = "    ...asStrings(runtimeEnv),\n  };";

/**
 * Where the demo E2E server keeps its local D1, R2 and queues: apart from the journeys'
 * server, so its sign-up does not count against their Better Auth sign-up limit (stored
 * in D1, per IP). Playwright migrates it before starting the server.
 */
export const DEMO_E2E_STATE = ".wrangler/e2e-demo-state";

/** The adapter options of the demo E2E server ({} for every other server). */
export function demoAdapterOptions(port) {
  return port ? { persistState: { path: DEMO_E2E_STATE } } : {};
}

/** The settings the demo E2E server runs with. */
export function demoOverrides(port) {
  return {
    DEMO_MODE: "on",
    DEMO_RETENTION_DAYS: "7",
    DEMO_SAMPLE_DATA: "on",
    APP_URL: `http://localhost:${port}`,
  };
}

export function localDemoPlugins(port) {
  if (!port) return [];
  if (!/^\d+$/.test(port)) throw new Error("E2E_DEMO_PORT must be a port");
  return [
    {
      name: "e2e-local-demo-mode",
      enforce: "pre",
      apply(_config, environment) {
        if (
          environment.command !== "serve" ||
          environment.mode !== "development"
        ) {
          throw new Error(
            "E2E_DEMO_PORT is only allowed in the development test server"
          );
        }
        return true;
      },
      // Its own dependency cache: two dev servers optimizing into one node_modules/.vite
      // race and break each other's imports.
      config() {
        return { cacheDir: "node_modules/.vite-e2e-demo" };
      },
      transform(code, id) {
        if (!id.split("?")[0].endsWith("/apps/web/src/lib/env.ts")) return null;
        if (code.split(injection).length !== 2) {
          throw new Error(
            "The E2E demo-mode injection point in src/lib/env.ts changed; review test/e2e/demo-vite.mjs"
          );
        }
        return {
          code: code.replace(
            injection,
            `    ...asStrings(runtimeEnv),\n    ...${JSON.stringify(demoOverrides(port))},\n  };`
          ),
          map: null,
        };
      },
    },
  ];
}
