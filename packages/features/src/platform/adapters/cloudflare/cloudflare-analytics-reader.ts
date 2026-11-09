import {
  AnalyticsReadError,
  type AnalyticsReader,
  type AnalyticsReaderRow,
} from "../../ports/analytics-reader";

/** Cloudflare's API base; the SQL API is per account, GraphQL is one endpoint. */
export const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

export interface CloudflareAnalyticsReaderConfig {
  readonly accountId: string;
  /** An API token with Account › Account Analytics › Read, scoped to this account. */
  readonly token: string;
  /** workerd's fetch (never called as a method of another object). */
  readonly fetch: (input: string, init: RequestInit) => Promise<Response>;
  /** Give up after this long; the page shows the failure instead of hanging. */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * The Analytics Engine SQL API (`POST /accounts/<id>/analytics_engine/sql`, the statement
 * as the body, JSON rows back) and the GraphQL Analytics API (`POST /graphql`).
 * https://developers.cloudflare.com/analytics/analytics-engine/sql-api/
 */
export function createCloudflareAnalyticsReader(
  config: CloudflareAnalyticsReaderConfig
): AnalyticsReader {
  const headers = { Authorization: `Bearer ${config.token}` };

  async function call(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await config.fetch(url, {
        ...init,
        signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AnalyticsReadError(
        "unavailable",
        `Cloudflare's analytics API did not answer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new AnalyticsReadError(
        "unauthorized",
        "Cloudflare refused the analytics token: it needs Account Analytics Read on this account"
      );
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new AnalyticsReadError(
        "unavailable",
        `Cloudflare's analytics API answered ${response.status}${detail ? `: ${detail}` : ""}`
      );
    }
    try {
      return await response.json();
    } catch {
      throw new AnalyticsReadError("invalid", "The answer was not JSON");
    }
  }

  return {
    async sql(statement) {
      const body = await call(
        `${CLOUDFLARE_API}/accounts/${encodeURIComponent(config.accountId)}/analytics_engine/sql`,
        { method: "POST", headers, body: statement }
      );
      const data = (body as { data?: unknown } | null)?.data;
      if (!Array.isArray(data))
        throw new AnalyticsReadError("invalid", "The SQL answer had no rows");
      return data.filter(
        (row): row is AnalyticsReaderRow =>
          Boolean(row) && typeof row === "object"
      );
    },
    async graphql(query, variables) {
      const body = (await call(`${CLOUDFLARE_API}/graphql`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      })) as {
        data?: unknown;
        errors?: readonly { message?: string }[] | null;
      } | null;
      if (body?.errors?.length) {
        throw new AnalyticsReadError(
          "invalid",
          `GraphQL: ${body.errors
            .map((error) => error.message ?? "error")
            .join("; ")
            .slice(0, 300)}`
        );
      }
      return body?.data ?? null;
    },
  };
}
