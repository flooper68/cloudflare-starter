import type { Database } from "../database";
import type { Clock } from "../kernel";
import {
  type Logger,
  noopProductAnalytics,
  type ProductAnalytics,
} from "../platform";
import { analyticsMilestones } from "./product-analytics.schema";

export interface MilestoneDeps {
  readonly db: Database;
  readonly clock: Clock;
  readonly analytics: ProductAnalytics;
  /** Where a failed write is reported; the work it follows never fails because of it. */
  readonly logger?: Pick<Logger, "warn">;
}

/**
 * Milestones this isolate already knows were recorded, so a person's tenth note costs no
 * second query. Bounded: when full it starts afresh (a later write is a no-op insert).
 */
const known = new Set<string>();
const KNOWN_LIMIT = 10_000;

/**
 * Records a funnel milestone (a TRIED_FEATURES id, or `returned`) once per person: true
 * when this call reached it first, false when it was reached before, analytics are off or
 * the person is left out of them (the noop adapter: nothing would be sent), or the write
 * failed (logged as `product_analytics.milestone_failed`; never thrown). A repeat insert
 * writes nothing (ON CONFLICT DO NOTHING).
 */
export async function reachMilestoneOnce(
  deps: MilestoneDeps,
  userId: string,
  milestone: string
): Promise<boolean> {
  if (deps.analytics === noopProductAnalytics) return false;
  const key = `${userId}\u0000${milestone}`;
  if (known.has(key)) return false;
  try {
    const inserted = await deps.db
      .insert(analyticsMilestones)
      .values({ userId, milestone, reachedAt: deps.clock.now() })
      .onConflictDoNothing()
      .returning({ milestone: analyticsMilestones.milestone });
    if (known.size >= KNOWN_LIMIT) known.clear();
    known.add(key);
    return inserted.length > 0;
  } catch (error) {
    deps.logger?.warn("product_analytics.milestone_failed", {
      "app.analytics.milestone": milestone,
      error,
    });
    return false;
  }
}
