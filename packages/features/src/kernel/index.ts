// Pure building blocks shared by every feature's domain: no I/O, no dependencies.
export type { Clock } from "./clock";
export { DomainError, type DomainErrorKind } from "./domain-error";
export { escapeHtml, html, SafeHtml } from "./html";
export type { Ids } from "./ids";
export {
  defineJob,
  type JobBackoff,
  type JobDefinition,
  type JobEnvelope,
  type PayloadSchema,
} from "./job";
export {
  defineNotification,
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type NotificationDefinition,
  type NotificationRenderContext,
  type Notify,
  type NotifyInput,
  type RenderedNotification,
} from "./notification";
export type { Random } from "./random";
export {
  type RequestContext,
  type RequestSource,
  TRACEPARENT_PATTERN,
} from "./request-context";
