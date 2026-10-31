import { sql } from "drizzle-orm";
import type { Database } from "../database";
/** Non-FK personal references: invitations and outstanding verification records. Auth-owned rows are deleted by its gateway. */
export async function eraseIdentityReferences(
  deps: { readonly db: Database },
  input: { readonly userId: string; readonly email: string }
) {
  await deps.db.run(
    sql`DELETE FROM workspace_invitations WHERE email=${input.email}`
  );
  await deps.db.run(
    sql`DELETE FROM verification WHERE identifier=${input.email} OR identifier=${input.userId} OR value=${input.userId} OR identifier=${`change-email-${input.userId}`} OR identifier=${`two-factor-${input.userId}`}`
  );
}
