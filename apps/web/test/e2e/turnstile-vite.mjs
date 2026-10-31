import { fileURLToPath } from "node:url";

const fetchInjection = "fetch: (input, init) => fetch(input, init),";
const outboundPath = fileURLToPath(new URL("../outbound.ts", import.meta.url));

/** Inject the existing Siteverify test transport only into the E2E dev server. */
export function localTurnstilePlugins(enabled) {
  if (!enabled) return [];
  return [
    {
      name: "e2e-local-turnstile",
      enforce: "pre",
      apply(_config, environment) {
        if (
          environment.command !== "serve" ||
          environment.mode !== "development"
        ) {
          throw new Error(
            "E2E_LOCAL_TURNSTILE is only allowed in the development test server"
          );
        }
        return true;
      },
      transform(code, id) {
        if (!id.split("?")[0].endsWith("/apps/web/src/server/platform.ts")) {
          return null;
        }
        if (code.split(fetchInjection).length !== 2) {
          throw new Error(
            "The E2E Siteverify fetch injection point changed; review the test harness"
          );
        }
        return {
          code:
            `import { outbound as e2eSiteverify } from ${JSON.stringify(outboundPath)};\n` +
            code.replace(
              fetchInjection,
              "fetch: (input, init) => e2eSiteverify(new Request(input, init)),"
            ),
          map: null,
        };
      },
    },
  ];
}
