import { defineConfig } from "drizzle-kit";

// Only `generate` is used. Migrations are applied by Wrangler
// (`wrangler d1 migrations apply`), never with `drizzle-kit push`.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
});
