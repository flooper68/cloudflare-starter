/**
 * The admin portal's analytics report (/admin/analytics, admin_get_analytics): the SQL it
 * runs on the Analytics Engine datasets and how the rows become the funnel and its
 * breakdowns. Pure: the use case runs the queries (get-analytics-report.ts). Counts weight
 * by `_sample_interval`; people are the pseudonymous keys of `blob2`.
 * docs/reference/product-analytics.md#the-analytics-page
 */
import {
  featureTriedEvent,
  sessionReturnedEvent,
  TRIED_FEATURE_LABELS,
} from "./feature-trials";
import {
  docsPageViewedEvent,
  siteCtaClickedEvent,
  siteFeatureMapUsedEvent,
  sitePageEngagedEvent,
  sitePageScrolledEvent,
  sitePageViewedEvent,
  siteVideoCompletedEvent,
  siteVideoPlayedEvent,
} from "./site-events";

/**
 * The accounts feature's events the report reads, by name (a domain imports no other
 * feature; analytics-report.test.ts checks they are in the catalog).
 */
export const SIGNED_UP_EVENT = "auth.signed_up";
export const SIGN_UP_STARTED_EVENT = "auth.sign_up_started";
export const SIGN_UP_FAILED_EVENT = "auth.sign_up_failed";
const signedUpEvent = { name: SIGNED_UP_EVENT };
const signUpStartedEvent = { name: SIGN_UP_STARTED_EVENT };
const signUpFailedEvent = { name: SIGN_UP_FAILED_EVENT };

/** The periods the report covers, in days. */
export const REPORT_PERIODS = [1, 7, 30] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/** People who tried at least this many features count as the depth step. */
export const DEPTH_FEATURES = 3;
/** A return counts for the funnel within this many days of the sign-up. */
export const RETURN_WINDOW_DAYS = 7;

/** Rows the queries may return; more are cut (and the report says so). */
export const ROW_LIMIT = 10_000;

/** An Analytics Engine dataset name: what wrangler.jsonc accepts, so it is safe in SQL. */
const DATASET_NAME = /^[a-z][a-z0-9_]{0,63}$/;

export interface AnalyticsDatasets {
  /** The product events dataset (the ANALYTICS_EVENTS binding's). */
  readonly events: string;
  /** The metrics dataset (METRICS_DATASET's), or null to leave routes out. */
  readonly metrics: string | null;
}

export interface ReportQueries {
  readonly site: string;
  readonly people: string;
  readonly routes: string | null;
}

/** SQL string literal of a catalog name (they never hold a quote; checked anyway). */
function literal(value: string): string {
  if (!/^[a-z0-9_.$]+$/.test(value)) throw new Error(`Bad literal ${value}`);
  return `'${value}'`;
}

function anyEvent(names: readonly string[]): string {
  return `(${names.map((name) => `index1 = ${literal(name)}`).join(" OR ")})`;
}

function since(days: ReportPeriod): string {
  return `timestamp > NOW() - INTERVAL '${days}' DAY`;
}

/** The public pages' events and the sign-up page's: anonymous, counted, not people. */
export const SITE_REPORT_EVENTS = [
  sitePageViewedEvent.name,
  sitePageScrolledEvent.name,
  sitePageEngagedEvent.name,
  siteCtaClickedEvent.name,
  siteVideoPlayedEvent.name,
  siteVideoCompletedEvent.name,
  siteFeatureMapUsedEvent.name,
  docsPageViewedEvent.name,
  signUpStartedEvent.name,
  signUpFailedEvent.name,
] as const;

/** The events of signed-in people, by pseudonymous key. */
export const PEOPLE_REPORT_EVENTS = [
  signedUpEvent.name,
  featureTriedEvent.name,
  sessionReturnedEvent.name,
] as const;

/**
 * The three statements of a report. Dataset names come from settings, so they are
 * checked against wrangler's naming; `days` is one of REPORT_PERIODS.
 */
export function reportQueries(
  datasets: AnalyticsDatasets,
  days: ReportPeriod
): ReportQueries {
  if (!DATASET_NAME.test(datasets.events))
    throw new Error("Bad events dataset name");
  if (datasets.metrics !== null && !DATASET_NAME.test(datasets.metrics))
    throw new Error("Bad metrics dataset name");
  if (!(REPORT_PERIODS as readonly number[]).includes(days))
    throw new Error("Bad period");
  const site = [
    "SELECT blob1 AS event, blob7 AS s1, blob8 AS s2, blob9 AS s3, blob10 AS s4,",
    "double1 AS n1, SUM(_sample_interval) AS total",
    `FROM ${datasets.events}`,
    `WHERE ${since(days)} AND ${anyEvent(SITE_REPORT_EVENTS)}`,
    "GROUP BY event, s1, s2, s3, s4, n1",
    "ORDER BY total DESC",
    `LIMIT ${ROW_LIMIT}`,
  ].join(" ");
  const people = [
    "SELECT blob2 AS person, blob1 AS event, blob7 AS s1, double1 AS n1,",
    "min(timestamp) AS first_at",
    `FROM ${datasets.events}`,
    `WHERE ${since(days)} AND blob2 != '' AND ${anyEvent(PEOPLE_REPORT_EVENTS)}`,
    "GROUP BY person, event, s1, n1",
    `LIMIT ${ROW_LIMIT}`,
  ].join(" ");
  // http.server.request.duration: blob2 the route, blob3 the status, double1 the summed
  // seconds, double2 the request count, double4 the slowest (analytics-engine-metrics.ts).
  const routes = datasets.metrics
    ? [
        "SELECT blob2 AS route, blob3 AS status,",
        "SUM(double2 * _sample_interval) AS requests,",
        "SUM(double1 * _sample_interval) AS seconds,",
        "max(double4) AS slowest",
        `FROM ${datasets.metrics}`,
        `WHERE ${since(days)} AND index1 = 'http.server.request.duration'`,
        "GROUP BY route, status",
        `LIMIT ${ROW_LIMIT}`,
      ].join(" ")
    : null;
  return { site, people, routes };
}

/** One row of the SQL API (`data` of its JSON answer). */
export type AnalyticsRow = Readonly<Record<string, unknown>>;

function text(row: AnalyticsRow, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function num(row: AnalyticsRow, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

/** `2026-11-09 10:00:00` (UTC, the SQL API's format) or ISO, as epoch ms; NaN if neither. */
export function parseTimestamp(value: string): number {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return Date.parse(iso);
}

export interface FunnelStep {
  readonly id:
    | "visit"
    | "interest"
    | "intent"
    | "sign_up_started"
    | "signed_up"
    | "first_try"
    | "depth"
    | "returned";
  readonly label: string;
  /** Events (the public steps) or people (from sign-up on). */
  readonly unit: "events" | "people";
  readonly count: number;
}

export interface CountRow {
  readonly key: string;
  readonly count: number;
}

export interface FeatureCount {
  readonly feature: string;
  readonly label: string;
  readonly people: number;
}

export interface RouteHealth {
  readonly route: string;
  readonly requests: number;
  readonly errors: number;
  readonly meanMs: number;
  readonly slowestMs: number;
}

export interface WebAnalyticsSummary {
  readonly visits: number;
  readonly pageViews: number;
  readonly referrers: readonly CountRow[];
  readonly countries: readonly CountRow[];
}

export interface AnalyticsReport {
  readonly status: "ok";
  readonly days: ReportPeriod;
  readonly generatedAt: string;
  readonly funnel: readonly FunnelStep[];
  readonly signUp: {
    readonly started: number;
    readonly completed: number;
    readonly failures: readonly CountRow[];
  };
  readonly activation: {
    /** People who signed up in the period: the cohort of the steps below. */
    readonly cohort: number;
    readonly tried: number;
    readonly medianMinutesToFirstTry: number | null;
    readonly firstFeatures: readonly FeatureCount[];
    /** People of the cohort by the number of features they tried (0, 1, 2, 3+). */
    readonly depth: readonly CountRow[];
    readonly returnedWithinWindow: number;
  };
  /** Every feature by the people who tried it in the period (any cohort). */
  readonly features: readonly FeatureCount[];
  readonly sources: {
    /** Visits (entry page views) by referring host; `''` is direct or unknown. */
    readonly referrers: readonly CountRow[];
    readonly campaigns: readonly CountRow[];
    /** Cloudflare Web Analytics for the same period; null when not configured or failed. */
    readonly webAnalytics: WebAnalyticsSummary | null;
  };
  readonly engagement: {
    readonly pages: readonly CountRow[];
    readonly scrollDepth: readonly CountRow[];
    readonly videos: readonly {
      readonly video: string;
      readonly played: number;
      readonly completed: number;
    }[];
    readonly featureMap: readonly CountRow[];
    readonly docsSections: readonly CountRow[];
  };
  readonly ctas: readonly {
    readonly cta: string;
    readonly placement: string;
    readonly clicks: number;
  }[];
  /** Requests, server errors and latency per route; null without the metrics dataset. */
  readonly routes: readonly RouteHealth[] | null;
  /** What the reader should know: rows cut, a source not configured or failing. */
  readonly notes: readonly string[];
}

export interface NotConfiguredReport {
  readonly status: "not_configured";
  /** The settings to set, by name. */
  readonly missing: readonly string[];
}

const add = (map: Map<string, number>, key: string, value: number) =>
  map.set(key, (map.get(key) ?? 0) + value);

const sorted = (map: Map<string, number>, limit = 20): CountRow[] =>
  [...map]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);

function featureLabel(feature: string): string {
  return (
    (TRIED_FEATURE_LABELS as Readonly<Record<string, string>>)[feature] ??
    feature
  );
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const value =
    ordered.length % 2
      ? (ordered[middle] ?? 0)
      : ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2;
  return Math.round(value * 10) / 10;
}

/** The report's site part: the public steps and their breakdowns. */
function siteSection(rows: readonly AnalyticsRow[]) {
  const visitsBy = new Map<string, number>();
  const campaigns = new Map<string, number>();
  const pages = new Map<string, number>();
  const scroll = new Map<string, number>();
  const featureMap = new Map<string, number>();
  const docs = new Map<string, number>();
  const failures = new Map<string, number>();
  const videos = new Map<string, { played: number; completed: number }>();
  const ctas = new Map<
    string,
    { cta: string; placement: string; clicks: number }
  >();
  let visits = 0;
  let interest = 0;
  let intent = 0;
  let started = 0;
  for (const row of rows) {
    const total = num(row, "total");
    const s1 = text(row, "s1");
    const s2 = text(row, "s2");
    switch (text(row, "event")) {
      case sitePageViewedEvent.name:
        add(pages, s1, total);
        if (s2 === "yes") {
          visits += total;
          add(visitsBy, text(row, "s3"), total);
          const source = text(row, "s4");
          if (source) add(campaigns, source, total);
        }
        break;
      case sitePageScrolledEvent.name:
        if (s1 === "home") add(scroll, String(num(row, "n1")), total);
        break;
      case sitePageEngagedEvent.name:
        interest += total;
        break;
      case siteCtaClickedEvent.name: {
        intent += total;
        const key = `${s1}\u0000${s2}`;
        const entry = ctas.get(key) ?? { cta: s1, placement: s2, clicks: 0 };
        ctas.set(key, { ...entry, clicks: entry.clicks + total });
        break;
      }
      case siteVideoPlayedEvent.name:
      case siteVideoCompletedEvent.name: {
        const entry = videos.get(s1) ?? { played: 0, completed: 0 };
        if (text(row, "event") === siteVideoPlayedEvent.name)
          entry.played += total;
        else entry.completed += total;
        videos.set(s1, entry);
        break;
      }
      case siteFeatureMapUsedEvent.name:
        add(featureMap, s1, total);
        break;
      case docsPageViewedEvent.name:
        add(docs, s1, total);
        break;
      case signUpStartedEvent.name:
        started += total;
        break;
      case signUpFailedEvent.name:
        add(failures, s1, total);
        break;
    }
  }
  return {
    visits,
    interest,
    intent,
    started,
    failures: sorted(failures),
    referrers: sorted(visitsBy),
    campaigns: sorted(campaigns),
    pages: sorted(pages),
    scrollDepth: ["25", "50", "75", "100"].map((key) => ({
      key,
      count: scroll.get(key) ?? 0,
    })),
    featureMap: sorted(featureMap),
    docsSections: sorted(docs),
    videos: [...videos]
      .map(([video, counts]) => ({ video, ...counts }))
      .sort((a, b) => b.played - a.played),
    ctas: [...ctas.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 20),
  };
}

interface Person {
  signedUpAt: number | null;
  returnedDays: number | null;
  /** First time per feature. */
  readonly features: Map<string, number>;
}

/** The report's people part: sign-ups, first tries, depth and returns. */
function peopleSection(rows: readonly AnalyticsRow[]) {
  const people = new Map<string, Person>();
  const person = (key: string) => {
    let found = people.get(key);
    if (!found) {
      found = { signedUpAt: null, returnedDays: null, features: new Map() };
      people.set(key, found);
    }
    return found;
  };
  for (const row of rows) {
    const key = text(row, "person");
    if (!key) continue;
    const at = parseTimestamp(text(row, "first_at"));
    const entry = person(key);
    switch (text(row, "event")) {
      case signedUpEvent.name:
        if (Number.isFinite(at))
          entry.signedUpAt = Math.min(entry.signedUpAt ?? at, at);
        break;
      case featureTriedEvent.name: {
        const feature = text(row, "s1");
        const previous = entry.features.get(feature);
        if (Number.isFinite(at))
          entry.features.set(feature, Math.min(previous ?? at, at));
        break;
      }
      case sessionReturnedEvent.name: {
        const days = num(row, "n1");
        entry.returnedDays = Math.min(entry.returnedDays ?? days, days);
        break;
      }
    }
  }
  const ranking = new Map<string, number>();
  const firsts = new Map<string, number>();
  const minutes: number[] = [];
  const depth = new Map<string, number>([
    ["0", 0],
    ["1", 0],
    ["2", 0],
    [`${DEPTH_FEATURES}+`, 0],
  ]);
  let cohort = 0;
  let tried = 0;
  let deep = 0;
  let returned = 0;
  for (const entry of people.values()) {
    for (const feature of entry.features.keys()) add(ranking, feature, 1);
    if (entry.signedUpAt === null) continue;
    cohort += 1;
    const count = entry.features.size;
    add(
      depth,
      count >= DEPTH_FEATURES ? `${DEPTH_FEATURES}+` : String(count),
      1
    );
    if (count >= DEPTH_FEATURES) deep += 1;
    if (entry.returnedDays !== null && entry.returnedDays <= RETURN_WINDOW_DAYS)
      returned += 1;
    if (count === 0) continue;
    tried += 1;
    const [first, at] = [...entry.features].sort((a, b) => a[1] - b[1])[0] ?? [
      "",
      0,
    ];
    add(firsts, first, 1);
    minutes.push(Math.max(0, (at - entry.signedUpAt) / 60_000));
  }
  const asFeatures = (map: Map<string, number>): FeatureCount[] =>
    sorted(map, 50).map(({ key, count }) => ({
      feature: key,
      label: featureLabel(key),
      people: count,
    }));
  return {
    cohort,
    tried,
    deep,
    returned,
    medianMinutesToFirstTry: median(minutes),
    firstFeatures: asFeatures(firsts),
    features: asFeatures(ranking),
    depth: [...depth].map(([key, count]) => ({ key, count })),
  };
}

/** Requests, errors and latency per route, worst first. */
function routesSection(rows: readonly AnalyticsRow[]): RouteHealth[] {
  const routes = new Map<
    string,
    { requests: number; errors: number; seconds: number; slowest: number }
  >();
  for (const row of rows) {
    const route = text(row, "route") || "(unmatched)";
    const entry = routes.get(route) ?? {
      requests: 0,
      errors: 0,
      seconds: 0,
      slowest: 0,
    };
    const requests = num(row, "requests");
    entry.requests += requests;
    if (Number(text(row, "status")) >= 500) entry.errors += requests;
    entry.seconds += num(row, "seconds");
    entry.slowest = Math.max(entry.slowest, num(row, "slowest"));
    routes.set(route, entry);
  }
  return [...routes]
    .map(([route, entry]) => ({
      route,
      requests: Math.round(entry.requests),
      errors: Math.round(entry.errors),
      meanMs: entry.requests
        ? Math.round((entry.seconds / entry.requests) * 1000)
        : 0,
      slowestMs: Math.round(entry.slowest * 1000),
    }))
    .sort(
      (a, b) =>
        b.errors - a.errors ||
        b.meanMs - a.meanMs ||
        a.route.localeCompare(b.route)
    )
    .slice(0, 25);
}

/** Turns the three answers into the report. */
export function buildAnalyticsReport(input: {
  readonly days: ReportPeriod;
  readonly now: Date;
  readonly site: readonly AnalyticsRow[];
  readonly people: readonly AnalyticsRow[];
  readonly routes: readonly AnalyticsRow[] | null;
  readonly webAnalytics: WebAnalyticsSummary | null;
  readonly notes?: readonly string[];
}): AnalyticsReport {
  const site = siteSection(input.site);
  const people = peopleSection(input.people);
  const notes = [...(input.notes ?? [])];
  if (input.site.length >= ROW_LIMIT || input.people.length >= ROW_LIMIT)
    notes.push(
      `More than ${ROW_LIMIT} rows: the report counts the first ${ROW_LIMIT}; choose a shorter period.`
    );
  return {
    status: "ok",
    days: input.days,
    generatedAt: input.now.toISOString(),
    funnel: [
      { id: "visit", label: "Visits", unit: "events", count: site.visits },
      {
        id: "interest",
        label: "Got the pitch",
        unit: "events",
        count: site.interest,
      },
      {
        id: "intent",
        label: "Clicked a call to action",
        unit: "events",
        count: site.intent,
      },
      {
        id: "sign_up_started",
        label: "Started sign-up",
        unit: "events",
        count: site.started,
      },
      {
        id: "signed_up",
        label: "Signed up",
        unit: "people",
        count: people.cohort,
      },
      {
        id: "first_try",
        label: "Tried a feature",
        unit: "people",
        count: people.tried,
      },
      {
        id: "depth",
        label: `Tried ${DEPTH_FEATURES}+ features`,
        unit: "people",
        count: people.deep,
      },
      {
        id: "returned",
        label: `Came back within ${RETURN_WINDOW_DAYS} days`,
        unit: "people",
        count: people.returned,
      },
    ],
    signUp: {
      started: site.started,
      completed: people.cohort,
      failures: site.failures,
    },
    activation: {
      cohort: people.cohort,
      tried: people.tried,
      medianMinutesToFirstTry: people.medianMinutesToFirstTry,
      firstFeatures: people.firstFeatures,
      depth: people.depth,
      returnedWithinWindow: people.returned,
    },
    features: people.features,
    sources: {
      referrers: site.referrers,
      campaigns: site.campaigns,
      webAnalytics: input.webAnalytics,
    },
    engagement: {
      pages: site.pages,
      scrollDepth: site.scrollDepth,
      videos: site.videos,
      featureMap: site.featureMap,
      docsSections: site.docsSections,
    },
    ctas: site.ctas,
    routes: input.routes ? routesSection(input.routes) : null,
    notes,
  };
}

/** The Web Analytics GraphQL query (rumPageloadEventsAdaptiveGroups) for one period. */
export const WEB_ANALYTICS_QUERY = `query WebAnalytics($accountTag: string!, $siteTag: string!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $siteTag, datetime_geq: $since, datetime_leq: $until }) {
        count
        sum { visits }
      }
      referrers: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [sum_visits_DESC], filter: { siteTag: $siteTag, datetime_geq: $since, datetime_leq: $until }) {
        sum { visits }
        dimensions { refererHost }
      }
      countries: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [sum_visits_DESC], filter: { siteTag: $siteTag, datetime_geq: $since, datetime_leq: $until }) {
        sum { visits }
        dimensions { countryName }
      }
    }
  }
}`;

interface RumGroup {
  readonly count?: unknown;
  readonly sum?: { readonly visits?: unknown };
  readonly dimensions?: Readonly<Record<string, unknown>>;
}

/** The Web Analytics summary of a GraphQL answer's `data`; null when it has none. */
export function parseWebAnalytics(data: unknown): WebAnalyticsSummary | null {
  const account = (
    data as {
      viewer?: {
        accounts?: readonly {
          total?: readonly RumGroup[];
          referrers?: readonly RumGroup[];
          countries?: readonly RumGroup[];
        }[];
      };
    } | null
  )?.viewer?.accounts?.[0];
  if (!account) return null;
  const visitsOf = (group: RumGroup) => Number(group.sum?.visits) || 0;
  const rows = (groups: readonly RumGroup[] | undefined, dimension: string) =>
    (groups ?? []).map((group) => ({
      key: String(group.dimensions?.[dimension] ?? "").slice(0, 100),
      count: visitsOf(group),
    }));
  const total = account.total?.[0];
  return {
    visits: total ? visitsOf(total) : 0,
    pageViews: total ? Number(total.count) || 0 : 0,
    referrers: rows(account.referrers, "refererHost"),
    countries: rows(account.countries, "countryName"),
  };
}
