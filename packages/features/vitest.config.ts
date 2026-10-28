import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Integration tests: use cases against a real local D1 and R2 in workerd (Miniflare),
// with the migrations applied. Each test file gets isolated storage.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    new URL("./migrations", import.meta.url).pathname
  );
  return {
    plugins: [
      cloudflareTest({
        main: "./test/worker.ts",
        wrangler: { configPath: "./test/wrangler.jsonc" },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      name: "features-integration",
      include: ["src/**/*.integration.test.ts"],
      setupFiles: ["./test/setup.ts"],
    },
  };
});
