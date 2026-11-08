import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import { type DemoRuntime, seedDemoWorkspaceJob } from "./domain";

/**
 * After sign-up (Better Auth's `user.create.after`, once the personal workspace is
 * provisioned): enqueues `demo.seed-workspace` when DEMO_MODE=on and DEMO_SAMPLE_DATA=on
 * and the user got a personal workspace (not in single mode, where the workspace is
 * shared). Returns whether it enqueued.
 */
export async function scheduleDemoSeed(
  deps: {
    readonly jobQueue: JobQueue;
    readonly clock: Clock;
    readonly ids: Ids;
    readonly demo: DemoRuntime;
  },
  input: {
    readonly userId: string;
    readonly workspaceId: string | null;
    readonly context: RequestContext;
  }
): Promise<boolean> {
  const { demo } = deps;
  if (demo.mode !== "on" || !demo.sampleData) return false;
  if (demo.workspaceMode === "single" || !input.workspaceId) return false;
  await enqueueJob(
    deps,
    seedDemoWorkspaceJob,
    { userId: input.userId, workspaceId: input.workspaceId },
    {
      context: {
        ...input.context,
        userId: input.userId,
        workspaceId: input.workspaceId,
      },
    }
  );
  return true;
}
