import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

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
          bindings: {
            TEST_MIGRATIONS: migrations,
            APP_URL: "http://localhost:4321",
            BETTER_AUTH_SECRET: "api-test-secret-0123456789abcdefghij",
            EMAIL_FROM: "noreply@example.test",
          },
        },
      }),
    ],
    test: {
      name: "web-api",
      include: ["test/api/**/*.test.ts"],
      setupFiles: ["./test/setup.ts"],
    },
  };
});
