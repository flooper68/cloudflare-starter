import cloudflare from "@astrojs/cloudflare";
import { satteri } from "@astrojs/markdown-satteri";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, sessionDrivers } from "astro/config";
import { devPort } from "./dev-port.mjs";
import { docsKitPlugins } from "./src/docs/kit/plugin.ts";
import {
  docsDiagramsPlugin,
  docsLinksPlugin,
  docsTablesPlugin,
  docsTaskListsPlugin,
} from "./src/docs/markdown-plugins.ts";
import { siteIntegrations } from "./src/docs/site-integrations.ts";
import { demoAdapterOptions, localDemoPlugins } from "./test/e2e/demo-vite.mjs";
import { localTurnstilePlugins } from "./test/e2e/turnstile-vite.mjs";

const REPO_ROOT = new URL("../../", import.meta.url);
// The public origin (https://starter.flooper.me), set by the deploy scripts at build
// time: canonical and og:url, the sitemap and its robots.txt line. Unset: left out.
const SITE_URL = process.env.SITE_URL || undefined;

export default defineConfig({
  output: "server",
  site: SITE_URL,
  devToolbar: { enabled: false },
  // No Cloudflare Images binding: images are served as they are. Switch to the
  // adapter's default to resize with Cloudflare Images (a paid feature).
  adapter: cloudflare({
    imageService: "passthrough",
    // The demo-mode E2E server only (test/e2e/demo-vite.mjs): its own local state.
    ...demoAdapterOptions(process.env.E2E_DEMO_PORT),
    // MEDIA_STATE_DIR: the walkthrough recorder (media/record.ts) runs `astro dev` on its
    // own throwaway local state (D1, R2, queues), so its seed never touches yours.
    ...(process.env.MEDIA_STATE_DIR
      ? { persistState: { path: process.env.MEDIA_STATE_DIR } }
      : {}),
  }),
  // Better Auth owns sessions; an in-memory driver keeps Astro from
  // provisioning its default SESSION KV namespace.
  session: { driver: sessionDrivers.lruCache() },
  // Docs search index (Pagefind) and the sitemap: src/docs/site-integrations.ts.
  integrations: [react(), ...siteIntegrations(SITE_URL)],
  // The docs site (/docs) renders the repository's Markdown (src/content.config.ts):
  // links written for GitHub are rewritten for the site and tables scroll in their own
  // box, and an image of a repository .svg is inlined as the diagram itself
  // (src/docs/markdown-plugins.ts, src/docs/diagrams.ts); code blocks carry both Shiki themes as CSS
  // variables, switched with data-theme (packages/ui/src/styles/prose.css).
  markdown: {
    processor: satteri({
      // The docs components kit (src/docs/kit/): `::flow`, `:::screenshot`, `:::steps`, …
      // as Markdown directives, rendered to static HTML.
      mdastPlugins: [
        docsDiagramsPlugin(REPO_ROOT),
        ...docsKitPlugins(REPO_ROOT),
      ],
      hastPlugins: [
        docsLinksPlugin(REPO_ROOT),
        docsTablesPlugin(),
        docsTaskListsPlugin(),
      ],
      // Off so text and heading ids match GitHub's ("--" stays "--"): links written
      // for GitHub then work on the site, and test/architecture/docs.test.ts models both.
      features: { smartPunctuation: false, directive: true },
    }),
    shikiConfig: {
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: false,
    },
  },
  // Off because OAuth token requests from MCP clients (Claude's servers) are
  // cross-site form POSTs to /api/auth/oauth2/token. Better Auth checks origins
  // itself, tRPC requires the x-trpc-source header, and /api/files checks Origin.
  //
  // csp: Astro hashes the inline scripts it renders into each page and sends them in a
  // Content-Security-Policy header; server/security-headers.ts keeps the script hashes
  // and replaces the rest with the app's full policy (`astro dev` sends none). Prerendered
  // pages (/docs) carry Astro's policy as a <meta> instead: styleDirective keeps it to
  // the pages' style-src ('unsafe-inline', no hashes, which would cancel it), since Shiki
  // colours code with style attributes (server/security-headers.ts, PRERENDERED_PAGE_CSP).
  security: {
    checkOrigin: false,
    csp: {
      algorithm: "SHA-256",
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
      // Pagefind's WebAssembly on the docs pages. Only the prerendered pages' <meta>
      // keeps it: the per-request page policy takes only the hashes from Astro.
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
    },
  },
  // The port of APP_URL in .dev.vars (4321 by default): Better Auth trusts only that origin.
  server: { port: devPort() },
  vite: {
    // Only a production build may be crawled (src/pages/robots.txt.ts).
    define: {
      "import.meta.env.SITE_INDEXABLE": JSON.stringify(
        process.env.CLOUDFLARE_ENV === "production"
      ),
    },
    // Page scripts stay files under /_astro/, never inline <script> code, so a strict
    // Content-Security-Policy (script-src 'self') needs no 'unsafe-inline' or nonce for
    // the prerendered pages. Fonts stay files too: a small subset inlined as a data: URL
    // would break font-src 'self'. Other assets keep Vite's default (undefined).
    build: {
      assetsInlineLimit: (file) =>
        /\.(js|woff2?|ttf|otf)$/.test(file) ? false : undefined,
    },
    plugins: [
      tailwindcss(),
      ...localTurnstilePlugins(process.env.E2E_LOCAL_TURNSTILE === "1"),
      ...localDemoPlugins(process.env.E2E_DEMO_PORT),
    ],
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
      dedupe: ["react", "react-dom"],
    },
  },
});
