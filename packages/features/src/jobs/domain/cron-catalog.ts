import type { RequestContext } from "../../kernel";

/**
 * A scheduled task. `schedule` is a cron expression (UTC) that must also be listed in
 * `triggers.crons` of every environment in apps/web/wrangler.jsonc (an architecture test
 * keeps them equal). `run` should stay small: enqueue jobs and let the queue do the work,
 * with its retries.
 */
export interface CronEntry<TDeps> {
  /** Stable dotted name (`jobs.purge-idempotency-keys`), used in logs and tests. */
  readonly name: string;
  readonly schedule: string;
  run(
    deps: TDeps,
    input: {
      /** When the run was scheduled (epoch ms): use it as "now" of the run. */
      readonly scheduledTime: number;
      readonly context: RequestContext;
    }
  ): Promise<unknown>;
}

export type CronCatalog<TDeps> = readonly CronEntry<TDeps>[];

/** Builds the catalog; throws on a duplicate name or an empty schedule. */
export function createCronCatalog<TDeps>(
  entries: readonly CronEntry<TDeps>[]
): CronCatalog<TDeps> {
  const names = new Set<string>();
  for (const entry of entries) {
    if (names.has(entry.name)) {
      throw new Error(`Cron entry "${entry.name}" is registered twice`);
    }
    if (entry.schedule.trim().split(/\s+/).length !== 5) {
      throw new Error(
        `Cron entry "${entry.name}" needs a five-field schedule, got "${entry.schedule}"`
      );
    }
    names.add(entry.name);
  }
  return entries;
}

/** The entries a Cron Trigger fires: those whose schedule is exactly `controller.cron`. */
export function cronEntriesFor<TDeps>(
  catalog: CronCatalog<TDeps>,
  cron: string
): readonly CronEntry<TDeps>[] {
  return catalog.filter((entry) => entry.schedule === cron);
}

/** The distinct schedules of the catalog, sorted: what `triggers.crons` must list. */
export function cronSchedules<TDeps>(catalog: CronCatalog<TDeps>): string[] {
  return [...new Set(catalog.map((entry) => entry.schedule))].sort();
}
