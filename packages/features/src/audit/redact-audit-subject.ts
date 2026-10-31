import { and, eq, or, sql } from "drizzle-orm";
import type { Database } from "../database";
import { auditEvents } from "./audit.schema";
/** The only audit update: remove a deleted subject's IP/email, never rewrite actions or other actors' events. */
export async function redactAuditSubject(
  deps: { readonly db: Database },
  input: { readonly userId: string; readonly email: string }
) {
  const t = auditEvents;
  await deps.db
    .update(t)
    .set({ ip: null })
    .where(
      or(
        eq(t.actorUserId, input.userId),
        and(eq(t.targetType, "user"), eq(t.targetId, input.userId)),
        and(eq(t.targetType, "email"), eq(t.targetId, input.email))
      )
    );
  await deps.db
    .update(t)
    .set({ targetType: "user", targetId: input.userId, ip: null })
    .where(and(eq(t.targetType, "email"), eq(t.targetId, input.email)));
  // Typed metadata can hold an invitation email; JSON replacement is exact-value only.
  let cursor = "";
  for (;;) {
    const rows = await deps.db
      .select({ id: t.id, metadata: t.metadata })
      .from(t)
      .where(
        and(
          sql`${t.id}>${cursor}`,
          sql`instr(CAST(${t.metadata} AS TEXT), ${input.email}) > 0`
        )
      )
      .orderBy(t.id)
      .limit(100);
    if (!rows.length) break;
    const redact = (value: unknown): unknown =>
      typeof value === "string"
        ? value === input.email
          ? input.userId
          : value
        : Array.isArray(value)
          ? value.map(redact)
          : value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value).map(([k, v]) => [k, redact(v)])
              )
            : value;
    for (const row of rows)
      await deps.db
        .update(t)
        .set({ metadata: redact(row.metadata) as Record<string, unknown> })
        .where(eq(t.id, row.id));
    cursor = rows.at(-1)?.id ?? cursor;
  }
}
