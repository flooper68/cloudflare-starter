// Pure building blocks shared by every feature's domain: no I/O, no dependencies.
export type { Clock } from "./clock";
export { DomainError, type DomainErrorKind } from "./domain-error";
export type { Ids } from "./ids";
export {
  defineJob,
  type JobBackoff,
  type JobDefinition,
  type JobEnvelope,
  type PayloadSchema,
} from "./job";
export type { Random } from "./random";
export {
  type RequestContext,
  type RequestSource,
  TRACEPARENT_PATTERN,
} from "./request-context";
