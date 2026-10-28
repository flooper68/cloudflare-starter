import { eq } from "drizzle-orm";

import type { Database } from "../database";
import { user } from "./accounts.schema";

export interface AccountUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
}

/** The user with this id, or null; used to resolve an MCP access token's subject. */
export async function findUserById(
  deps: { readonly db: Database },
  id: string
): Promise<AccountUser | null> {
  const row = await deps.db.query.user.findFirst({ where: eq(user.id, id) });
  return row ? { id: row.id, email: row.email, name: row.name } : null;
}
