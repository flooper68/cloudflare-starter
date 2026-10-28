import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, sessionDrivers } from "astro/config";

export default defineConfig({
  output: "server",
  devToolbar: { enabled: false },
  adapter: cloudflare(),
  // Better Auth owns sessions; an in-memory driver keeps Astro from
  // provisioning its default SESSION KV namespace.
  session: { driver: sessionDrivers.lruCache() },
  integrations: [react()],
  server: { port: 4321 },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
      dedupe: ["react", "react-dom"],
    },
  },
});
