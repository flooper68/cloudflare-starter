import path from "node:path";
import { defineConfig } from "vitest/config";

// `bun run test` runs three projects (docs/architecture/testing.md):
// - unit: domain rules, pure helpers, architecture tests (Node)
// - features-integration: use cases against real D1/R2 in workerd (packages/features)
// - web-api: tRPC, HTTP routes, auth and /mcp in workerd (apps/web)
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { "@": path.resolve(__dirname, "apps/web/src") } },
        test: {
          name: "unit",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude: [
            "**/node_modules/**",
            "**/*.integration.test.ts",
            "apps/web/test/**",
            "apps/web/public/**",
          ],
        },
      },
      "packages/features/vitest.config.ts",
      "apps/web/vitest.config.ts",
    ],
  },
});
