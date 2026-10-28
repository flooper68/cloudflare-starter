// Pure building blocks shared by every feature's domain: no I/O, no dependencies.
export {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_LIMITS,
  type AnalyticsEventDefinition,
  type AnalyticsEventLayout,
  type AnalyticsProperties,
  type AnalyticsPropertyValue,
  defineEvent,
  IDENTIFY_EVENT,
} from "./analytics-event";
export type { BillingGate } from "./billing-gate";
export type { Clock } from "./clock";
export {
  DomainError,
  type DomainErrorDetails,
  type DomainErrorKind,
} from "./domain-error";
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
