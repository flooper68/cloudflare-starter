import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import clerk from "@clerk/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  output: "server",
  devToolbar: { enabled: false },
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [
    react(),
    clerk({
      signInUrl: "/sign-in",
      signUpUrl: "/sign-up",
      signInFallbackRedirectUrl: "/app/dashboard",
      signUpFallbackRedirectUrl: "/app/dashboard",
      afterSignOutUrl: "/",
    }),
  ],
  env: {
    schema: {
      APP_URL: envField.string({ context: "server", access: "secret" }),
      DATABASE_URL: envField.string({ context: "server", access: "secret" }),
      CLERK_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
      }),
      R2_ACCOUNT_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      R2_ACCESS_KEY_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      R2_SECRET_ACCESS_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      R2_FILES_BUCKET_NAME: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      MAILJET_API_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      MAILJET_SECRET_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      MAILJET_FROM_EMAIL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      MAILJET_FROM_NAME: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      MAILJET_SANDBOX: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      APP_ENV: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
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
