import { recordAuditEvent } from "../audit";
import type { Database } from "../database";
import type { Clock, Ids, RequestContext } from "../kernel";
import {
  CREATOR_ROLE,
  requireMode,
  type WorkspaceMode,
  workspaceNameSchema,
} from "./domain";
import type { WorkspaceSummary } from "./list-workspaces";
import { workspaceMembers, workspaces } from "./workspaces.schema";

/** Multi mode: a new shared workspace with the user as its owner, made their active one. */
export async function createWorkspace(
  deps: {
    readonly db: Database;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly requestContext: RequestContext;
  },
  input: {
    readonly userId: string;
    readonly mode: WorkspaceMode;
    readonly name: string;
  }
): Promise<WorkspaceSummary> {
  requireMode(input.mode, "create", "Creating a workspace");
  const name = workspaceNameSchema.parse(input.name);
  const id = deps.ids.uuid();

  await deps.db.batch([
    deps.db
      .insert(workspaces)
      .values({ id, name, kind: "shared", createdBy: input.userId }),
    deps.db.insert(workspaceMembers).values({
      workspaceId: id,
      userId: input.userId,
      role: CREATOR_ROLE,
      lastActiveAt: deps.clock.now(),
    }),
  ]);
  await recordAuditEvent(deps, deps.requestContext, {
    action: "workspace.created",
    actor: { kind: "user", userId: input.userId },
    workspaceId: id,
    target: { type: "workspace", id },
    metadata: { kind: "shared" },
  });
  return { id, name, kind: "shared", role: CREATOR_ROLE };
}
