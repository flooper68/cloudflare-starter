import { eq } from "drizzle-orm";

import type { Database } from "../database";
import { qaOutbox } from "./qa.schema";

/** Deletes every QA outbox message to `to` (DELETE /api/qa/outbox); returns how many. */
export async function clearQaMail(
  deps: { readonly db: Database },
  input: { readonly to: string }
): Promise<{ readonly deleted: number }> {
  const result = await deps.db
    .delete(qaOutbox)
    .where(eq(qaOutbox.recipient, input.to.trim().toLowerCase()))
    .run();
  return { deleted: result.meta.changes ?? 0 };
}
