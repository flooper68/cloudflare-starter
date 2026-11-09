/**
 * Reading analytics back (the admin portal's Analytics page and admin_get_analytics):
 * SQL over the Workers Analytics Engine datasets and the Cloudflare GraphQL Analytics API
 * (Web Analytics). Adapters: cloudflare (the account's APIs with an API token that has
 * Account Analytics Read), memory (canned answers for tests). Only admins reach it.
 */

/** One row of an SQL answer, by column alias. */
export type AnalyticsReaderRow = Readonly<Record<string, unknown>>;

/** Why a read failed: the token was refused, the API failed, or it answered nonsense. */
export type AnalyticsReadFailure = "unauthorized" | "unavailable" | "invalid";

export class AnalyticsReadError extends Error {
  constructor(
    readonly reason: AnalyticsReadFailure,
    message: string
  ) {
    super(message);
    this.name = "AnalyticsReadError";
  }
}

export interface AnalyticsReader {
  /** Runs one SQL statement; its rows. Throws AnalyticsReadError. */
  sql(statement: string): Promise<readonly AnalyticsReaderRow[]>;
  /** Runs one GraphQL query; its `data`. Throws AnalyticsReadError. */
  graphql(
    query: string,
    variables: Readonly<Record<string, unknown>>
  ): Promise<unknown>;
}
