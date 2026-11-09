import type { Clock } from "../kernel";
import {
  AnalyticsReadError,
  type AnalyticsReader,
  type AnalyticsReaderRow,
  type Logger,
} from "../platform";
import {
  type AnalyticsDatasets,
  type AnalyticsReport,
  AnalyticsUnavailableError,
  buildAnalyticsReport,
  type NotConfiguredReport,
  parseWebAnalytics,
  type ReportPeriod,
  reportQueries,
  WEB_ANALYTICS_QUERY,
  type WebAnalyticsSummary,
} from "./domain";

/** What the report reads from, as configured (null: that part is not set up). */
export interface AnalyticsReadSettings {
  /** ANALYTICS_READ_TOKEN and ANALYTICS_ACCOUNT_ID made a reader; null when either is missing. */
  readonly reader: AnalyticsReader | null;
  readonly accountId: string | null;
  /** ANALYTICS_EVENTS_DATASET; null when not set. */
  readonly eventsDataset: string | null;
  /** METRICS_DATASET_NAME; null leaves errors and latency per route out. */
  readonly metricsDataset: string | null;
  /** WEB_ANALYTICS_SITE_TAG; null leaves Web Analytics out. */
  readonly webAnalyticsSiteTag: string | null;
}

/** The settings a report cannot run without, by name, in the order to set them. */
function missingAnalyticsSettings(settings: AnalyticsReadSettings): string[] {
  const missing: string[] = [];
  if (!settings.reader)
    missing.push("ANALYTICS_READ_TOKEN", "ANALYTICS_ACCOUNT_ID");
  if (!settings.eventsDataset) missing.push("ANALYTICS_EVENTS_DATASET");
  return missing;
}

function failure(error: unknown): string {
  return error instanceof AnalyticsReadError
    ? error.message
    : "Unexpected error";
}

/**
 * The admin portal's analytics report for the last `days` days: the funnel from visit to
 * return, its breakdowns, and errors and latency per route, read from Analytics Engine
 * (and Web Analytics when its site tag is set). Callers are platform admins (the
 * `admin.analytics.get` procedure). Without a reader or dataset it answers which settings
 * are missing instead of failing; a failing events query fails the report
 * (AnalyticsReadError), a failing optional part becomes a note.
 */
export async function getAnalyticsReport(
  deps: {
    readonly clock: Clock;
    readonly logger?: Pick<Logger, "warn">;
  },
  settings: AnalyticsReadSettings,
  input: { readonly days: ReportPeriod }
): Promise<AnalyticsReport | NotConfiguredReport> {
  const missing = missingAnalyticsSettings(settings);
  if (missing.length > 0 || !settings.reader || !settings.eventsDataset)
    return { status: "not_configured", missing };
  const reader = settings.reader;
  const datasets: AnalyticsDatasets = {
    events: settings.eventsDataset,
    metrics: settings.metricsDataset,
  };
  const queries = reportQueries(datasets, input.days);
  const now = deps.clock.now();
  const notes: string[] = [];

  const optional = async <T>(
    what: string,
    run: () => Promise<T>
  ): Promise<T | null> => {
    try {
      return await run();
    } catch (error) {
      deps.logger?.warn("product_analytics.read_failed", {
        "app.analytics.part": what,
        error,
      });
      notes.push(`${what} could not be read: ${failure(error)}`);
      return null;
    }
  };

  const required = async (statement: string) => {
    try {
      return await reader.sql(statement);
    } catch (error) {
      if (error instanceof AnalyticsReadError)
        throw new AnalyticsUnavailableError(error.message);
      throw error;
    }
  };
  const [site, people, routes, webAnalytics] = await Promise.all([
    required(queries.site),
    required(queries.people),
    queries.routes
      ? optional<readonly AnalyticsReaderRow[]>(
          "Errors and latency per route",
          () => reader.sql(queries.routes ?? "")
        )
      : Promise.resolve(null),
    settings.webAnalyticsSiteTag && settings.accountId
      ? optional<WebAnalyticsSummary | null>("Web Analytics", async () =>
          parseWebAnalytics(
            await reader.graphql(WEB_ANALYTICS_QUERY, {
              accountTag: settings.accountId,
              siteTag: settings.webAnalyticsSiteTag,
              since: new Date(
                now.getTime() - input.days * 86_400_000
              ).toISOString(),
              until: now.toISOString(),
            })
          )
        )
      : Promise.resolve(null),
  ]);
  if (!queries.routes)
    notes.push(
      "Errors and latency per route need METRICS_DATASET_NAME (and METRICS=analytics-engine)."
    );
  if (!settings.webAnalyticsSiteTag)
    notes.push(
      "Web Analytics visits and referrers need WEB_ANALYTICS_SITE_TAG; the referrers below come from the site's own events."
    );
  return buildAnalyticsReport({
    days: input.days,
    now,
    site,
    people,
    routes,
    webAnalytics,
    notes,
  });
}
