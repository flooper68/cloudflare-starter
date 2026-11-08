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
            // apps/web/test runs in workerd (api) or Playwright (e2e, qa); only the QA
            // suite's pure helpers are unit tests.
            "apps/web/test/api/**",
            "apps/web/test/e2e/**",
            "apps/web/test/e2e-build/**",
            "apps/web/public/**",
            // Agents' git worktrees: each is a full checkout with its own tests.
            ".claude/worktrees/**",
          ],
        },
      },
      "packages/features/vitest.config.ts",
      "apps/web/vitest.config.ts",
    ],
  },
});
