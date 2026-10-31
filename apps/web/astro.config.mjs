import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, sessionDrivers } from "astro/config";

import { devPort } from "./dev-port.mjs";
import { localTurnstilePlugins } from "./test/e2e/turnstile-vite.mjs";

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
