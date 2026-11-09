import { and, eq, getTableColumns } from "drizzle-orm";

import { user } from "../accounts";
import type { Database } from "../database";
import { type Actor, requirePermission } from "../workspaces";
import { containerRuns } from "./container-runs.schema";
import {
  ContainerRunNotFoundError,
  type ContainerRunRef,
  type ContainerRunSummary,
  containerRunRefSchema,
  toContainerRunSummary,
} from "./domain";

/** A run of the actor's workspace with its step timeline and result (`containers.read`). */
export async function getContainerRun(
  deps: { readonly db: Database },
  actor: Actor,
  input: ContainerRunRef
): Promise<ContainerRunSummary> {
  requirePermission(actor, "containers.read");
  const parsed = containerRunRefSchema.parse(input);
  const [row] = await deps.db
    .select({ ...getTableColumns(containerRuns), createdByName: user.name })
    .from(containerRuns)
    .leftJoin(user, eq(user.id, containerRuns.createdBy))
    .where(
      and(
        eq(containerRuns.id, parsed.runId),
        eq(containerRuns.workspaceId, actor.workspaceId)
      )
    );
  if (!row) throw new ContainerRunNotFoundError();
  return toContainerRunSummary(row);
}
