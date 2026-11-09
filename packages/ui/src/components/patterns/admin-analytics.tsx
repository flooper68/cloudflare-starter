import {
  Activity,
  BarChart3,
  Clapperboard,
  Compass,
  Gauge,
  Info,
  MousePointerClick,
  Settings2,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";

import { Callout } from "../callout";
import { Card } from "../card";
import { EmptyState } from "../empty-state";
import { SegmentedControl, SegmentedControlItem } from "../segmented-control";
import { Skeleton } from "../skeleton";
import { Stat } from "../stat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";

export interface AdminAnalyticsCount {
  readonly key: string;
  readonly count: number;
}

export interface AdminAnalyticsFeature {
  readonly feature: string;
  readonly label: string;
  readonly people: number;
}

/** The report of `admin.analytics.get` (packages/features getAnalyticsReport). */
export interface AdminAnalyticsReport {
  readonly status: "ok";
  readonly days: number;
  readonly generatedAt: string;
  readonly funnel: readonly {
    readonly id: string;
    readonly label: string;
    readonly unit: "events" | "people";
    readonly count: number;
  }[];
  readonly signUp: {
    readonly started: number;
    readonly completed: number;
    readonly failures: readonly AdminAnalyticsCount[];
  };
  readonly activation: {
    readonly cohort: number;
    readonly tried: number;
    readonly medianMinutesToFirstTry: number | null;
    readonly firstFeatures: readonly AdminAnalyticsFeature[];
    readonly depth: readonly AdminAnalyticsCount[];
    readonly returnedWithinWindow: number;
  };
  readonly features: readonly AdminAnalyticsFeature[];
  readonly sources: {
    readonly referrers: readonly AdminAnalyticsCount[];
    readonly campaigns: readonly AdminAnalyticsCount[];
    readonly webAnalytics: {
      readonly visits: number;
      readonly pageViews: number;
      readonly referrers: readonly AdminAnalyticsCount[];
      readonly countries: readonly AdminAnalyticsCount[];
    } | null;
  };
  readonly engagement: {
    readonly pages: readonly AdminAnalyticsCount[];
    readonly scrollDepth: readonly AdminAnalyticsCount[];
    readonly videos: readonly {
      readonly video: string;
      readonly played: number;
      readonly completed: number;
    }[];
    readonly featureMap: readonly AdminAnalyticsCount[];
    readonly docsSections: readonly AdminAnalyticsCount[];
  };
  readonly ctas: readonly {
    readonly cta: string;
    readonly placement: string;
    readonly clicks: number;
  }[];
  readonly routes:
    | readonly {
        readonly route: string;
        readonly requests: number;
        readonly errors: number;
        readonly meanMs: number;
        readonly slowestMs: number;
      }[]
    | null;
  readonly notes: readonly string[];
}

export type AdminAnalyticsData =
  | AdminAnalyticsReport
  | { readonly status: "not_configured"; readonly missing: readonly string[] };

export interface AdminAnalyticsProps {
  readonly data: AdminAnalyticsData;
  /** The period shown, in days (1, 7 or 30). */
  readonly days: number;
  readonly onDaysChange: (days: number) => void;
}

const number = new Intl.NumberFormat("en");
const percent = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** "1 day", "7 days". */
function period(days: number): string {
  return days === 1 ? "24 hours" : `${days} days`;
}

/** A duration in minutes, readable: "45 s", "12 min", "3.5 h", "2 days". */
function minutes(value: number | null): string {
  if (value === null) return "–";
  if (value < 1) return `${Math.round(value * 60)} s`;
  if (value < 10) return `${Math.round(value * 10) / 10} min`;
  if (value < 120) return `${Math.round(value)} min`;
  if (value < 2880) return `${Math.round((value / 60) * 10) / 10} h`;
  return `${Math.round(value / 1440)} days`;
}

/** The period switch: 24 hours, 7 days, 30 days. */
export function AdminAnalyticsPeriod({
  days,
  onDaysChange,
}: Pick<AdminAnalyticsProps, "days" | "onDaysChange">) {
  return (
    <SegmentedControl
      aria-label="Period"
      value={String(days)}
      onValueChange={(value) => onDaysChange(Number(value))}
    >
      <SegmentedControlItem value="1">24 hours</SegmentedControlItem>
      <SegmentedControlItem value="7">7 days</SegmentedControlItem>
      <SegmentedControlItem value="30">30 days</SegmentedControlItem>
    </SegmentedControl>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-sm font-medium text-fg [&_svg]:size-4 [&_svg]:text-fg-muted">
          {icon}
          {title}
        </h2>
        {description ? (
          <p className="text-xs text-fg-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </Card>
  );
}

/** Horizontal bars of labelled counts; `empty` when there is nothing to show. */
function Bars({
  rows,
  empty,
  label,
}: {
  readonly rows: readonly { readonly label: string; readonly count: number }[];
  readonly empty: string;
  /** What the list counts, for screen readers ("visits by referrer"). */
  readonly label: string;
}) {
  if (rows.length === 0 || rows.every((row) => row.count === 0)) {
    return <p className="text-sm text-fg-muted">{empty}</p>;
  }
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul aria-label={label} className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-3 text-sm"
        >
          <span className="truncate text-fg-muted" title={row.label}>
            {row.label}
          </span>
          <span className="h-2 rounded-sm bg-hover" aria-hidden>
            <span
              className="block h-2 rounded-sm bg-accent"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-fg">
            {number.format(row.count)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const counts = (rows: readonly AdminAnalyticsCount[], blank = "(none)") =>
  rows.map((row) => ({ label: row.key || blank, count: row.count }));

const SIGN_UP_FAILURES: Readonly<Record<string, string>> = {
  invalid: "Form incomplete",
  bot_check: "Bot check refused",
  exists: "Account exists",
  not_allowed: "Sign-up not open to them",
  rate_limited: "Too many attempts",
  error: "Other error",
};

/** The funnel: each step's count and its share of the step before. */
function Funnel({ report }: { readonly report: AdminAnalyticsReport }) {
  const max = Math.max(1, ...report.funnel.map((step) => step.count));
  return (
    <ol aria-label="Funnel" className="flex flex-col gap-2">
      {report.funnel.map((step, index) => {
        const previous = index > 0 ? report.funnel[index - 1] : undefined;
        const share =
          previous && previous.count > 0 ? step.count / previous.count : null;
        return (
          <li
            key={step.id}
            className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm max-sm:grid-cols-[1fr_auto]"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-fg">{step.label}</span>
              <span className="text-xs text-fg-muted">
                {step.unit === "people" ? "people" : "events"}
              </span>
            </span>
            <span className="h-6 rounded-sm bg-hover max-sm:hidden" aria-hidden>
              <span
                className="block h-6 rounded-sm bg-accent/80"
                style={{ width: `${(step.count / max) * 100}%` }}
              />
            </span>
            <span className="flex items-baseline justify-end gap-2 tabular-nums">
              <span className="text-base font-semibold text-fg">
                {number.format(step.count)}
              </span>
              <span className="w-14 text-right text-xs text-fg-muted">
                {share === null ? "" : percent.format(share)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The admin portal's Analytics page: the product funnel from a visit to a return within
 * the demo window, then where visitors come from, whether they get the pitch, what they
 * click, sign-up drop-off, which features people try first and most, and errors and
 * latency per route. Public steps count events (there is no visitor id); from sign-up on
 * the counts are people. `not_configured` names the settings to set.
 */
export function AdminAnalytics({
  data,
  days,
  onDaysChange,
}: AdminAnalyticsProps) {
  if (data.status === "not_configured") {
    return (
      <EmptyState
        icon={<Settings2 />}
        title="Analytics are not connected"
        description={`The report reads Workers Analytics Engine with an API token that has Account Analytics Read. Set ${data.missing.join(", ")} (bun run setup:secrets), then reload.`}
      />
    );
  }
  const report = data;
  const web = report.sources.webAnalytics;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminAnalyticsPeriod days={days} onDaysChange={onDaysChange} />
        <p className="text-xs text-fg-muted">
          Last {period(report.days)}, as of{" "}
          {new Date(report.generatedAt)
            .toISOString()
            .slice(0, 16)
            .replace("T", " ")}{" "}
          UTC
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Compass />}
          label="Visits"
          value={number.format(report.funnel[0]?.count ?? 0)}
        />
        <Stat
          icon={<UserPlus />}
          label="Sign-ups"
          value={number.format(report.activation.cohort)}
        />
        <Stat
          icon={<MousePointerClick />}
          label="Tried a feature"
          value={number.format(report.activation.tried)}
        />
        <Stat
          icon={<Gauge />}
          label="Time to first try (median)"
          value={minutes(report.activation.medianMinutesToFirstTry)}
        />
      </div>

      <Section
        icon={<BarChart3 />}
        title="Funnel"
        description="Visit → interest → intent → sign-up → first try → depth → return. Public steps count events (no visitor ids by design); from sign-up on they count people."
      >
        <Funnel report={report} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          icon={<Compass />}
          title="Where visits come from"
          description="Entry page views by referring site (the site's own events)."
        >
          <Bars
            label="Visits by referrer"
            rows={counts(report.sources.referrers, "Direct or unknown")}
            empty="No visits in this period."
          />
          {report.sources.campaigns.length > 0 ? (
            <>
              <p className="text-xs text-fg-muted">By utm_source</p>
              <Bars
                label="Visits by campaign"
                rows={counts(report.sources.campaigns)}
                empty="No campaigns."
              />
            </>
          ) : null}
          {web ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-xs text-fg-muted">
                Cloudflare Web Analytics: {number.format(web.visits)} visits,{" "}
                {number.format(web.pageViews)} page views
              </p>
              <Bars
                label="Web Analytics visits by referrer"
                rows={counts(web.referrers, "Direct or unknown")}
                empty="No referrers."
              />
            </div>
          ) : null}
        </Section>

        <Section
          icon={<MousePointerClick />}
          title="Calls to action"
          description="Clicks by call to action and where on the page."
        >
          <Bars
            label="Clicks by call to action"
            rows={report.ctas.map((row) => ({
              label: `${row.cta} · ${row.placement}`,
              count: row.clicks,
            }))}
            empty="No clicks in this period."
          />
        </Section>

        <Section
          icon={<Clapperboard />}
          title="Did they get the pitch?"
          description="Home page scroll depth, videos, the feature map and docs sections."
        >
          <Bars
            label="Home page views by scroll depth"
            rows={report.engagement.scrollDepth.map((row) => ({
              label: `Scrolled ${row.key}%`,
              count: row.count,
            }))}
            empty="No home page scrolling yet."
          />
          {report.engagement.videos.length > 0 ? (
            <Bars
              label="Videos played"
              rows={report.engagement.videos.map((video) => ({
                label: `${video.video} (${number.format(video.completed)} finished)`,
                count: video.played,
              }))}
              empty="No videos played."
            />
          ) : (
            <p className="text-sm text-fg-muted">No videos played.</p>
          )}
          <Bars
            label="Feature map uses"
            rows={counts(report.engagement.featureMap).map((row) => ({
              label: `Feature map: ${row.label}`,
              count: row.count,
            }))}
            empty="The feature map was not used."
          />
          <Bars
            label="Docs views by section"
            rows={counts(report.engagement.docsSections).map((row) => ({
              label: `Docs: ${row.label}`,
              count: row.count,
            }))}
            empty="No docs read."
          />
        </Section>

        <Section
          icon={<UserPlus />}
          title="Sign-up"
          description={`${number.format(report.signUp.started)} started, ${number.format(report.signUp.completed)} completed.`}
        >
          <Bars
            label="Failed sign-up attempts by reason"
            rows={report.signUp.failures.map((row) => ({
              label: SIGN_UP_FAILURES[row.key] ?? row.key,
              count: row.count,
            }))}
            empty="No failed attempts."
          />
        </Section>

        <Section
          icon={<Activity />}
          title="Features people tried"
          description="People who tried each feature in this period, any sign-up date."
        >
          <Bars
            label="People by feature tried"
            rows={report.features.map((row) => ({
              label: row.label,
              count: row.people,
            }))}
            empty="Nobody tried a feature yet."
          />
        </Section>

        <Section
          icon={<Gauge />}
          title="First try and depth"
          description={`Of ${number.format(report.activation.cohort)} sign-ups: the first feature tried, features per person, and ${number.format(report.activation.returnedWithinWindow)} back within 7 days.`}
        >
          <Bars
            label="People by first feature tried"
            rows={report.activation.firstFeatures.map((row) => ({
              label: row.label,
              count: row.people,
            }))}
            empty="No first tries yet."
          />
          <Bars
            label="People by number of features tried"
            rows={report.activation.depth.map((row) => ({
              label: `${row.key} ${row.key === "1" ? "feature" : "features"}`,
              count: row.count,
            }))}
            empty="No sign-ups in this period."
          />
        </Section>
      </div>

      {report.routes ? (
        <Section
          icon={<Activity />}
          title="Errors and latency per route"
          description="Server errors (5xx) and mean duration of each route, worst first."
        >
          {report.routes.length === 0 ? (
            <p className="text-sm text-fg-muted">No requests recorded.</p>
          ) : (
            <Table aria-label="Errors and latency per route">
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Mean</TableHead>
                  <TableHead className="text-right">Slowest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.routes.map((route) => (
                  <TableRow key={route.route}>
                    <TableCell className="max-w-64 truncate font-mono text-xs">
                      {route.route}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {number.format(route.requests)}
                    </TableCell>
                    <TableCell
                      className={
                        route.errors > 0
                          ? "text-right tabular-nums text-danger"
                          : "text-right tabular-nums"
                      }
                    >
                      {number.format(route.errors)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {number.format(route.meanMs)} ms
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {number.format(route.slowestMs)} ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      ) : null}

      {report.notes.length > 0 ? (
        <Callout tone="neutral" icon={<Info />} title="About these numbers">
          <ul className="list-disc pl-4">
            {report.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Callout>
      ) : null}
    </div>
  );
}

/** Loading placeholder shaped like the report. */
export function AdminAnalyticsSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading analytics"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-8 w-64 rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </div>
  );
}
