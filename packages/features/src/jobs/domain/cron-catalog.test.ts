import { describe, expect, it } from "vitest";

import {
  createCronCatalog,
  cronEntriesFor,
  cronSchedules,
} from "./cron-catalog";

const entry = (name: string, schedule: string) => ({
  name,
  schedule,
  run: async () => {},
});

describe("cron catalog", () => {
  const catalog = createCronCatalog([
    entry("jobs.purge-idempotency-keys", "17 3 * * *"),
    entry("audit.purge", "17 3 * * *"),
    entry("reports.weekly", "0 6 * * 1"),
  ]);

  it("matches the entries whose schedule is exactly the trigger's cron", () => {
    expect(cronEntriesFor(catalog, "17 3 * * *").map((e) => e.name)).toEqual([
      "jobs.purge-idempotency-keys",
      "audit.purge",
    ]);
    expect(cronEntriesFor(catalog, "0 6 * * 1").map((e) => e.name)).toEqual([
      "reports.weekly",
    ]);
    expect(cronEntriesFor(catalog, "17 3 * * 1")).toEqual([]);
    expect(cronEntriesFor(catalog, "17  3 * * *")).toEqual([]);
  });

  it("lists each schedule once, sorted, for triggers.crons", () => {
    expect(cronSchedules(catalog)).toEqual(["0 6 * * 1", "17 3 * * *"]);
  });

  it("refuses duplicate names and schedules that are not five fields", () => {
    expect(() =>
      createCronCatalog([entry("a.b", "* * * * *"), entry("a.b", "0 * * * *")])
    ).toThrow(/registered twice/);
    expect(() => createCronCatalog([entry("a.b", "* * * *")])).toThrow(
      /five-field/
    );
  });
});
