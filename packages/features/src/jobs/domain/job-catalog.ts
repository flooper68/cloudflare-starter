import type { JobBackoff, JobDefinition, RequestContext } from "../../kernel";
import { InvalidJobPayloadError, UnknownJobTypeError } from "./errors";
import { JOB_TYPE_PATTERN } from "./job-envelope";

/** One delivery of a job, as its handler sees it. */
export interface JobRun {
  /** The envelope id: the same on every retry of this job. */
  readonly id: string;
  readonly type: string;
  /** When the job was enqueued (the envelope's `time`). */
  readonly time: string;
  /** 1 on the first delivery. */
  readonly attempts: number;
  /** This delivery's request context: the producer's trace, its user and workspace. */
  readonly context: RequestContext;
}

/** A job type with its handler, ready for the catalog. */
export interface RegisteredJob<TDeps> {
  readonly type: string;
  readonly backoff: JobBackoff;
  /**
   * Validates `data` against the job's payload schema, then runs the handler. Throws an
   * InvalidJobPayloadError (permanent) when the payload does not match.
   */
  run(deps: TDeps, data: unknown, job: JobRun): Promise<void>;
}

/** Pairs a job definition with the use case that handles it. */
export function registerJob<TDeps, TPayload>(
  definition: JobDefinition<TPayload>,
  handle: (deps: TDeps, payload: TPayload, job: JobRun) => Promise<unknown>
): RegisteredJob<TDeps> {
  return {
    type: definition.type,
    backoff: definition.backoff,
    async run(deps, data, job) {
      const parsed = definition.payload.safeParse(data);
      if (!parsed.success) {
        throw new InvalidJobPayloadError(definition.type, parsed.error);
      }
      await handle(deps, parsed.data, job);
    },
  };
}

/** Every job type the consumer can run, by type. */
export type JobCatalog<TDeps> = ReadonlyMap<string, RegisteredJob<TDeps>>;

/** Builds the catalog; throws on a malformed or duplicate type, so a bad catalog fails at startup and in tests. */
export function createJobCatalog<TDeps>(
  jobs: readonly RegisteredJob<TDeps>[]
): JobCatalog<TDeps> {
  const catalog = new Map<string, RegisteredJob<TDeps>>();
  for (const job of jobs) {
    if (!JOB_TYPE_PATTERN.test(job.type)) {
      throw new Error(
        `Job type "${job.type}" must be <feature>.<job> in lowercase kebab-case`
      );
    }
    if (catalog.has(job.type)) {
      throw new Error(`Job type "${job.type}" is registered twice`);
    }
    catalog.set(job.type, job);
  }
  return catalog;
}

/** The registered job for `type`; throws UnknownJobTypeError (permanent) when there is none. */
export function findJob<TDeps>(
  catalog: JobCatalog<TDeps>,
  type: string
): RegisteredJob<TDeps> {
  const job = catalog.get(type);
  if (!job) throw new UnknownJobTypeError(type);
  return job;
}
