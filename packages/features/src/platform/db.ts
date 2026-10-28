import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";

/** A Drizzle client over D1 for a given set of tables. */
export type Db<TSchema extends Record<string, unknown>> =
  DrizzleD1Database<TSchema>;

/** Creates the Drizzle client over the D1 binding (`env.DB`). */
export function createDb<TSchema extends Record<string, unknown>>(
  d1: D1Database,
  schema: TSchema
): Db<TSchema> {
  return drizzle(d1, { schema });
}
