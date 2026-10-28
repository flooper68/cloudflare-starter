/** The usage period `now` falls in: its calendar month in UTC, as `YYYY-MM`. */
export function usagePeriod(now: Date): string {
  return now.toISOString().slice(0, 7);
}
