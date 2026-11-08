import { lt } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { qaOutboxCutoff } from "./domain";
import { qaOutbox } from "./qa.schema";

/**
 * Deletes QA outbox mail older than 24 hours. Run daily by the `qa-outbox.purge` job
 * (cron-catalog.ts); reads ignore older mail in between.
 */
export async function purgeQaOutbox(deps: {
  readonly db: Database;
  readonly clock: Clock;
}): Promise<{ readonly deleted: number }> {
  const result = await deps.db
    .delete(qaOutbox)
    .where(lt(qaOutbox.createdAt, qaOutboxCutoff(deps.clock.now())))
    .run();
  return { deleted: result.meta.changes ?? 0 };
}
