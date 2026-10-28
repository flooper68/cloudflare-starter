/** Days covered by the overview's daily series (sign-ups, active users). */
export const OVERVIEW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One point of a daily series: the UTC day (`YYYY-MM-DD`) and its count. */
export interface DailyCount {
  readonly date: string;
  readonly count: number;
}

/** The UTC day of a time, as `YYYY-MM-DD` (the key D1's `date(…, 'unixepoch')` produces). */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Start (00:00 UTC) of the first day of a `days`-long window that ends with `now`'s day. */
export function windowStart(now: Date, days: number = OVERVIEW_DAYS): Date {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return new Date(today - (days - 1) * DAY_MS);
}

/**
 * A complete daily series from `start`, `days` long, oldest first: days without a row
 * count zero, so a chart has no gaps.
 */
export function dailySeries(
  start: Date,
  days: number,
  rows: readonly DailyCount[]
): DailyCount[] {
  const counts = new Map(rows.map((row) => [row.date, row.count]));
  return Array.from({ length: days }, (_, index) => {
    const date = utcDay(new Date(start.getTime() + index * DAY_MS));
    return { date, count: counts.get(date) ?? 0 };
  });
}

/** Workspace size buckets of the overview, by member count. */
export const WORKSPACE_SIZE_BUCKETS = [
  { label: "1 member", min: 1, max: 1 },
  { label: "2–5 members", min: 2, max: 5 },
  { label: "6–20 members", min: 6, max: 20 },
  { label: "21+ members", min: 21, max: Number.POSITIVE_INFINITY },
] as const;

export interface SizeBucket {
  readonly label: string;
  readonly count: number;
}

/** How many workspaces fall into each size bucket (empty workspaces are left out). */
export function workspaceSizeBuckets(
  memberCounts: readonly number[]
): SizeBucket[] {
  return WORKSPACE_SIZE_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: memberCounts.filter(
      (members) => members >= bucket.min && members <= bucket.max
    ).length,
  }));
}
