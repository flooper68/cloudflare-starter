import { type Database, eq, users } from "@cloudflare-starter/features";

export interface ClerkUserSnapshot {
  readonly id: string;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly primaryEmailAddress?: {
    readonly emailAddress: string;
  } | null;
}

export async function ensureUserFromClerk(
  db: Database,
  clerkUser: ClerkUserSnapshot
) {
  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (!email) {
    throw new Error("Signed-in Clerk user is missing a primary email address");
  }

  const name = [clerkUser.firstName, clerkUser.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const existing = await db.query.users.findFirst({
    where: (current, operators) =>
      operators.eq(current.clerkUserId, clerkUser.id),
  });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        email,
        name: name || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: clerkUser.id,
      email,
      name: name || null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create user");
  }

  return created;
}
