import { eq } from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import { WorkspaceNotFoundError, workspaces } from "../workspaces";
import { workspaceAddon } from "./billing.schema";
import {
  findAddon,
  type SetAddonsInput,
  setAddonsInputSchema,
  UnknownCatalogKeyError,
} from "./domain";

/**
 * Platform admin: replaces a workspace's add-ons in one batch (an empty list removes them
 * all). Records `billing.addons_set`. The caller has checked that the user is a platform
 * admin.
 */
export async function setAddons(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  admin: { readonly userId: string },
  input: SetAddonsInput
): Promise<{
  readonly addons: readonly { addonId: string; quantity: number }[];
}> {
  const parsed = setAddonsInputSchema.parse(input);
  for (const addon of parsed.addons) {
    if (!findAddon(addon.addonId))
      throw new UnknownCatalogKeyError("addon", addon.addonId);
  }
  const [workspace] = await deps.db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, parsed.workspaceId));
  if (!workspace) throw new WorkspaceNotFoundError();

  await deps.db.batch([
    deps.db
      .delete(workspaceAddon)
      .where(eq(workspaceAddon.workspaceId, parsed.workspaceId)),
    ...parsed.addons.map((addon) =>
      deps.db
        .insert(workspaceAddon)
        .values({ workspaceId: parsed.workspaceId, ...addon })
    ),
  ]);

  await recordAuditEvent(deps, deps.requestContext, {
    action: "billing.addons_set",
    actor: { kind: "admin", userId: admin.userId },
    workspaceId: parsed.workspaceId,
    target: { type: "workspace", id: parsed.workspaceId },
    metadata: { addons: parsed.addons },
  });
  return { addons: parsed.addons };
}
