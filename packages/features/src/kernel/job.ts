/**
 * The shapes every feature uses to declare a background job, and the envelope a job travels
 * in. Pure types and one identity helper: features declare jobs in their `domain/`, which may
 * import only the kernel. The rules (envelope schema, backoff, retries, idempotency) live in
 * the jobs feature (`packages/features/src/jobs`).
 */

/**
 * Anything that validates an unknown value into `T`: a zod schema satisfies it. Kept
 * structural so the kernel does not depend on zod.
 */
export interface PayloadSchema<T> {
  safeParse(
    input: unknown
  ):
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: unknown };
}

/**
 * How a failed attempt waits before the next one: exponential from `initialDelaySeconds`,
 * doubling per attempt, capped at `maxDelaySeconds` (at most 86400, the Queues limit).
 * `jitter` spreads the retries of many failing jobs apart: "full" waits 1..delay, "equal"
 * delay/2..delay, "none" exactly the delay. No defaults: each job states all three.
 */
export interface JobBackoff {
  readonly initialDelaySeconds: number;
  readonly maxDelaySeconds: number;
  readonly jitter: "full" | "equal" | "none";
}

/** A job type: its name on the wire, payload schema, retry backoff and idempotency. */
export interface JobDefinition<TPayload> {
  /**
   * The CloudEvents `type`: `<feature>.<job>` in lowercase kebab-case
   * (`greetings.hello`). Unique across the job catalog.
   */
  readonly type: string;
  readonly payload: PayloadSchema<TPayload>;
  readonly backoff: JobBackoff;
  /**
   * When set, a job whose key completed within the idempotency window (7 days) is skipped,
   * whether redelivered or re-enqueued; a run that dies before it is marked done runs again
   * (at least once, deduplicated; not exactly once). Return a stable value
   * derived from the payload (`invoice-${payload.invoiceId}`); the job type is prefixed.
   */
  readonly idempotencyKey?: (payload: TPayload) => string;
}

/** Declares a job type. Lives in the owning feature's `domain/`. */
export function defineJob<TPayload>(
  definition: JobDefinition<TPayload>
): JobDefinition<TPayload> {
  return Object.freeze({ ...definition });
}

/**
 * One job on the queue, shaped after CloudEvents 1.0 (https://cloudevents.io/): the core
 * attributes plus the extension attributes `traceparent` (W3C Trace Context of the
 * producer), `idempotencykey`, `userid` and `workspaceid` (lowercase alphanumeric names, as
 * the spec requires for extensions). `data` is the job's payload.
 */
export interface JobEnvelope {
  readonly specversion: "1.0";
  /** Unique per job (a UUID); the same on every redelivery. */
  readonly id: string;
  /** URI-reference of the producing context: `/<environment>/<http|queue|cron>`. */
  readonly source: string;
  /** The job type (`greetings.hello`). */
  readonly type: string;
  /** RFC 3339 time the job was enqueued. */
  readonly time: string;
  readonly datacontenttype: "application/json";
  readonly data: unknown;
  readonly traceparent?: string;
  readonly idempotencykey?: string;
  readonly userid?: string;
  readonly workspaceid?: string;
}
