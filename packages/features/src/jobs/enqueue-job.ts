import type {
  Clock,
  Ids,
  JobDefinition,
  JobEnvelope,
  RequestContext,
} from "../kernel";
import { formatTraceparent, type JobQueue } from "../platform";
import {
  CLOUDEVENTS_SPEC_VERSION,
  InvalidJobPayloadError,
  idempotencyKeyFor,
} from "./domain";

/**
 * Validates the payload against the job's schema, wraps it in a CloudEvents envelope that
 * carries the caller's trace, user and workspace, and puts it on the queue. The only way
 * features enqueue work (lint/rules/no-direct-queue-send.grit). Throws
 * InvalidJobPayloadError before anything is sent.
 */
export async function enqueueJob<TPayload>(
  deps: {
    readonly jobQueue: JobQueue;
    readonly clock: Clock;
    readonly ids: Ids;
  },
  definition: JobDefinition<TPayload>,
  payload: TPayload,
  options: {
    /** The unit of work that enqueues: the job continues its trace. */
    readonly context: RequestContext;
    /** Wait before the first attempt: an integer, 0 to 86400. */
    readonly delaySeconds?: number;
  }
): Promise<{ readonly id: string }> {
  const parsed = definition.payload.safeParse(payload);
  if (!parsed.success) {
    throw new InvalidJobPayloadError(definition.type, parsed.error);
  }
  const { context } = options;
  const idempotencyKey = idempotencyKeyFor(definition, parsed.data);
  const envelope: JobEnvelope = {
    specversion: CLOUDEVENTS_SPEC_VERSION,
    id: deps.ids.uuid(),
    source: `/${context.environment}/${context.source}`,
    type: definition.type,
    time: deps.clock.now().toISOString(),
    datacontenttype: "application/json",
    data: parsed.data,
    traceparent: formatTraceparent(context),
    ...(idempotencyKey ? { idempotencykey: idempotencyKey } : {}),
    ...(context.userId ? { userid: context.userId } : {}),
    ...(context.workspaceId ? { workspaceid: context.workspaceId } : {}),
  };
  await deps.jobQueue.send(
    envelope,
    options.delaySeconds === undefined
      ? {}
      : { delaySeconds: options.delaySeconds }
  );
  return { id: envelope.id };
}
