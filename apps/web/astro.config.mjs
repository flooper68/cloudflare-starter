import cloudflare from "@astrojs/cloudflare";
import { satteri } from "@astrojs/markdown-satteri";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, sessionDrivers } from "astro/config";
import { devPort } from "./dev-port.mjs";
import {
  docsLinksPlugin,
  docsTablesPlugin,
} from "./src/docs/markdown-plugins.ts";
import { localTurnstilePlugins } from "./test/e2e/turnstile-vite.mjs";

const REPO_ROOT = new URL("../../", import.meta.url);

export default defineConfig({
  output: "server",
  devToolbar: { enabled: false },
  // No Cloudflare Images binding: images are served as they are. Switch to the
  // adapter's default to resize with Cloudflare Images (a paid feature).
  adapter: cloudflare({ imageService: "passthrough" }),
  // Better Auth owns sessions; an in-memory driver keeps Astro from
  // provisioning its default SESSION KV namespace.
  session: { driver: sessionDrivers.lruCache() },
  integrations: [react()],
  // The docs site (/docs) renders the repository's Markdown (src/content.config.ts):
  // links written for GitHub are rewritten for the site and tables scroll in their own
  // box (src/docs/markdown-plugins.ts); code blocks carry both Shiki themes as CSS
  // variables, switched with data-theme (packages/ui/src/styles/prose.css).
  markdown: {
    processor: satteri({
      hastPlugins: [docsLinksPlugin(REPO_ROOT), docsTablesPlugin()],
      // Off so text and heading ids match GitHub's ("--" stays "--"): links written
      // for GitHub then work on the site, and test/architecture/docs.test.ts models both.
      features: { smartPunctuation: false },
    }),
    shikiConfig: {
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: false,
    },
  },
  // Off because OAuth token requests from MCP clients (Claude's servers) are
  // cross-site form POSTs to /api/auth/oauth2/token. Better Auth checks origins
  // itself, tRPC requires the x-trpc-source header, and /api/files checks Origin.
  security: { checkOrigin: false },
  // The port of APP_URL in .dev.vars (4321 by default): Better Auth trusts only that origin.
  server: { port: devPort() },
  vite: {
    plugins: [
      tailwindcss(),
      ...localTurnstilePlugins(process.env.E2E_LOCAL_TURNSTILE === "1"),
    ],
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
      dedupe: ["react", "react-dom"],
    },
  },
});
