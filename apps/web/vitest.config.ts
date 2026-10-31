import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

import { API_TEST_BINDINGS } from "./test/api-bindings";
import { outbound } from "./test/outbound";

// API tests: tRPC procedures, HTTP routes, auth and /mcp as a signed-in user, inside
// workerd (Miniflare) with this app's real bindings (wrangler.jsonc) and a migrated D1.
// Each test file gets isolated storage.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    fileURLToPath(
      new URL("../../packages/features/migrations", import.meta.url)
    )
  );
  return {
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    plugins: [
      cloudflareTest({
        main: "./test/worker.ts",
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Pinned so a local .dev.vars cannot change test behaviour (test/api-bindings.ts).
          bindings: { ...API_TEST_BINDINGS, TEST_MIGRATIONS: migrations },
          // Siteverify is answered locally; nothing reaches the network (test/outbound.ts).
          outboundService: outbound,
        },
      }),
    ],
    test: {
      name: "web-api",
      // Large warm-module snapshots exceed workerd's 32 MiB WebSocket limit.
      // Keep per-file storage isolation; fetch transformed modules individually.
      // https://github.com/cloudflare/workers-sdk/issues/16349
      fsModuleCache: false,
      include: ["test/api/**/*.test.ts"],
      setupFiles: ["./test/setup.ts"],
    },
  };
});
