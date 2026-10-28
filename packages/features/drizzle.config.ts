import { defineConfig } from "drizzle-kit";

// Only `generate` is used. Migrations are applied by Wrangler
// (`wrangler d1 migrations apply`), never with `drizzle-kit push`.
export default defineConfig({
  dialect: "sqlite",
  // Every feature keeps its tables in <feature>/<feature>.schema.ts.
  schema: "./src/*/*.schema.ts",
  out: "./migrations",
});
