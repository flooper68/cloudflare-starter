import { count, eq } from "drizzle-orm";

import type { Database } from "../database";
import type { BillingGate, RequestContext } from "../kernel";
import type { ProductAnalytics } from "../platform";
import { identifyUser, workspaceSizeBucket } from "../product-analytics";
import type { Actor } from "./domain";
import { workspaceMembers } from "./workspaces.schema";

/**
 * Sends the member's analytics traits (Segment `identify`): their role in the workspace,
 * its size bucket and its plan in effect (billing). Called by the use cases that change them: creating a workspace,
 * joining one. One count query on the workspace's members and billing's plan lookup; when either fails the identify
 * call is dropped, so analytics never fails a change that already succeeded.
 */
export async function identifyMember(
  deps: {
    readonly db: Database;
    readonly analytics: ProductAnalytics;
    readonly requestContext: RequestContext;
    readonly billing: BillingGate;
  },
  actor: Actor
): Promise<void> {
  let members: number;
  let plan: string;
  try {
    const [row] = await deps.db
      .select({ members: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, actor.workspaceId));
    members = row?.members ?? 1;
    plan = await deps.billing.planId(actor.workspaceId);
  } catch {
    return;
  }
  identifyUser(
    deps,
    {
      ...deps.requestContext,
      userId: actor.userId,
      workspaceId: actor.workspaceId,
    },
    {
      role: actor.role,
      workspace_size: workspaceSizeBucket(members),
      plan,
    }
  );
}
