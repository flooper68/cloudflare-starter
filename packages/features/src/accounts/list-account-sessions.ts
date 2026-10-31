import { and, desc, eq, gt } from "drizzle-orm";
import type { Database } from "../database";
import type { Clock } from "../kernel";
import { session } from "./accounts.schema";

/** Public session summaries deliberately exclude bearer tokens. */
export async function listAccountSessions(
  deps: { readonly db: Database; readonly clock: Clock },
  input: { readonly userId: string; readonly currentSessionId?: string }
) {
  const rows = await deps.db
    .select({
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    })
    .from(session)
    .where(
      and(
        eq(session.userId, input.userId),
        gt(session.expiresAt, deps.clock.now())
      )
    )
    .orderBy(desc(session.createdAt));
  return rows.map((row) => ({
    ...row,
    current: row.id === input.currentSessionId,
  }));
}
