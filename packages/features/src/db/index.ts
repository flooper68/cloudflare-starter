import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export { and, desc, eq } from "drizzle-orm";
export * from "./schema";

import * as schema from "./schema";

export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
  });

  return drizzle(client, {
    schema,
    casing: "snake_case",
  });
}

export type Database = ReturnType<typeof createDb>;
