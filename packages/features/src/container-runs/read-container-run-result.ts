import { and, eq } from "drizzle-orm";

import type { Database } from "../database";
import { type Actor, requirePermission } from "../workspaces";
import { containerRuns } from "./container-runs.schema";
import {
  ContainerRunNotFoundError,
  type ContainerRunRef,
  ContainerRunResultUnavailableError,
  containerRunRefSchema,
} from "./domain";

/**
 * The stored result of a run of the actor's workspace (`containers.read`), for the
 * download route: the R2 object and a file name. A run of another workspace is not found;
 * one without a result (running, failed, or its object gone) is unavailable.
 */
export async function readContainerRunResult(
  deps: { readonly db: Database; readonly bucket: R2Bucket },
  actor: Actor,
  input: ContainerRunRef
): Promise<{ readonly object: R2ObjectBody; readonly filename: string }> {
  requirePermission(actor, "containers.read");
  const parsed = containerRunRefSchema.parse(input);
  const [row] = await deps.db
    .select({
      digits: containerRuns.digits,
      resultKey: containerRuns.resultKey,
    })
    .from(containerRuns)
    .where(
      and(
        eq(containerRuns.id, parsed.runId),
        eq(containerRuns.workspaceId, actor.workspaceId)
      )
    );
  if (!row) throw new ContainerRunNotFoundError();
  if (!row.resultKey) throw new ContainerRunResultUnavailableError();
  const object = await deps.bucket.get(row.resultKey);
  if (!object) throw new ContainerRunResultUnavailableError();
  return { object, filename: `pi-${row.digits}-digits.txt` };
}
