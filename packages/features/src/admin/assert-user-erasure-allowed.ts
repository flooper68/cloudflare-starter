import type { Database } from "../database";
import type { Clock } from "../kernel";
import { requireAnotherAdminRemains } from "./domain";
import { countActiveAdmins, findTargetUser } from "./lookups";
/** Shared preflight for self-service and administrator deletion; runs before any data mutation. */
export async function assertUserErasureAllowed(
  deps: { readonly db: Database; readonly clock: Clock },
  userId: string
) {
  const target = await findTargetUser(deps.db, userId);
  requireAnotherAdminRemains(
    target,
    await countActiveAdmins(deps.db, deps.clock.now()),
    deps.clock.now()
  );
}
