import { z } from "zod";

import { type JobEnvelope, TRACEPARENT_PATTERN } from "../../kernel";

/** CloudEvents spec version of every envelope. */
export const CLOUDEVENTS_SPEC_VERSION = "1.0";

/** `<feature>.<job>`, lowercase kebab-case segments: `greetings.hello`. */
export const JOB_TYPE_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/**
 * A job envelope as it arrives from the queue: CloudEvents 1.0 core attributes (structured
 * JSON mode) plus our extension attributes. `data` is checked later, against the job's
 * own payload schema. Unknown attributes are dropped.
 */
export const jobEnvelopeSchema = z.object({
  specversion: z.literal(CLOUDEVENTS_SPEC_VERSION),
  id: z.string().min(1).max(200),
  source: z.string().min(1).max(200),
  type: z.string().regex(JOB_TYPE_PATTERN),
  time: z.iso.datetime(),
  datacontenttype: z.literal("application/json"),
  data: z.unknown(),
  traceparent: z.string().regex(TRACEPARENT_PATTERN).optional(),
  idempotencykey: z.string().min(1).max(500).optional(),
  userid: z.string().min(1).max(200).optional(),
  workspaceid: z.string().min(1).max(200).optional(),
}) satisfies z.ZodType<JobEnvelope>;

export type ParsedJobEnvelope =
  | { readonly ok: true; readonly envelope: JobEnvelope }
  | { readonly ok: false; readonly issues: readonly z.core.$ZodIssue[] };

/** Validates a message body from the queue. Never throws. */
export function parseJobEnvelope(body: unknown): ParsedJobEnvelope {
  const parsed = jobEnvelopeSchema.safeParse(body);
  return parsed.success
    ? { ok: true, envelope: parsed.data as JobEnvelope }
    : { ok: false, issues: parsed.error.issues };
}
