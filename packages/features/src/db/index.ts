import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";

export { and, desc, eq } from "drizzle-orm";
export * from "./schema";

import * as schema from "./schema";

export { schema };
export type Database = DrizzleD1Database<typeof schema>;

/** Creates the Drizzle client over the D1 binding (`env.DB`). */
export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema });
}
