import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";

/** The completed self-deletion, recorded after Better Auth removed the user. */
export async function recordAccountDeletion(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: { readonly userId: string }
) {
  await recordAuditEvent(deps, deps.requestContext, {
    action: "user.deleted",
    actor: { kind: "user", userId: input.userId },
    target: { type: "user", id: input.userId },
  });
}
