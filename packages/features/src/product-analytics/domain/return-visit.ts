const DAY_MS = 86_400_000;

/**
 * Calendar days (UTC) from one instant to another: 0 on the same UTC day, 1 the day
 * after, however few hours apart. The funnel's return step (`app.session_returned`).
 */
export function utcDaysBetween(from: Date, to: Date): number {
  const day = (date: Date) =>
    Math.floor(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
        DAY_MS
    );
  return day(to) - day(from);
}
