import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

/**
 * One run of every story in one theme: renders in real Chromium, passes the axe
 * accessibility checks (contrast included) and runs its `play` function.
 */
function storiesIn(theme: "dark" | "light") {
  return defineProject({
    plugins: [
      storybookTest({
        configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
      }),
    ],
    // Read by .storybook/preview.tsx as the initial theme.
    define: {
      "import.meta.env.VITE_STORYBOOK_THEME": JSON.stringify(theme),
    },
    test: {
      name: `storybook-${theme}`,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: "chromium" }],
      },
    },
  });
}

// Component tests in both themes: `bun run test:components`.
export default {
  test: { projects: [storiesIn("dark"), storiesIn("light")] },
};
