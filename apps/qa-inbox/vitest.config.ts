import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// The QA inbox Worker in workerd (Miniflare) with its own wrangler.jsonc and a migrated
// local D1, like the app's API tests. Each test file gets isolated storage.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    fileURLToPath(new URL("./migrations", import.meta.url))
  );
  return {
    plugins: [
      cloudflareTest({
        main: "./src/index.ts",
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            QA_INBOX_TOKEN: "qa-inbox-test-token-0123456789abcdefghij",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      name: "qa-inbox",
      include: ["test/**/*.test.ts"],
      setupFiles: ["./test/setup.ts"],
    },
  };
});
