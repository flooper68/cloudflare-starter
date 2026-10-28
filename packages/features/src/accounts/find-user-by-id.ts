import { eq } from "drizzle-orm";

import type { Database } from "../database";
import type { Clock } from "../kernel";
import { user } from "./accounts.schema";

export interface AccountUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

/**
 * The user with this id, or null; used to resolve an MCP access token's subject. A user
 * whose suspension is in force (admin portal ban) counts as no user, so their tokens stop
 * working at once, like their browser sessions.
 */
export async function findUserById(
  deps: { readonly db: Database; readonly clock: Clock },
  id: string
): Promise<AccountUser | null> {
  const row = await deps.db.query.user.findFirst({ where: eq(user.id, id) });
  if (!row) return null;
  const suspended =
    row.banned === true &&
    (!row.banExpires || row.banExpires.getTime() > deps.clock.now().getTime());
  return suspended ? null : { id: row.id, email: row.email, name: row.name };
}
