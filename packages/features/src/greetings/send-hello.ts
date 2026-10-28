import { enqueueJob } from "../jobs";
import type { Clock, Ids, RequestContext } from "../kernel";
import type { JobQueue } from "../platform";
import { helloJob } from "./domain";

/** Enqueues a hello job; it runs in the background as the caller's user, in the caller's trace. */
export async function sendHello(
  deps: {
    readonly jobQueue: JobQueue;
    readonly clock: Clock;
    readonly ids: Ids;
  },
  input: { readonly name: string },
  options: { readonly context: RequestContext }
): Promise<{ readonly id: string }> {
  return enqueueJob(
    deps,
    helloJob,
    { name: input.name },
    { context: options.context }
  );
}
