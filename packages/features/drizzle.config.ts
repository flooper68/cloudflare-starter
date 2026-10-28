import { defineConfig } from "drizzle-kit";

// Only `generate` is used. Migrations are applied by Wrangler
// (`wrangler d1 migrations apply`), never with `drizzle-kit push`.
export default defineConfig({
  dialect: "sqlite",
  // Every feature keeps its tables in <feature>/<feature>.schema.ts; an adapter that
  // stores data in D1 (the feature-flag provider) in platform/adapters/<vendor>/.
  schema: ["./src/*/*.schema.ts", "./src/platform/adapters/*/*.schema.ts"],
  out: "./migrations",
});
