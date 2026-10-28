/**
 * The shapes every feature uses to declare a notification and to send one. Pure types and
 * one identity helper, like `defineJob`: a feature declares its notifications in its own
 * `domain/` (which may import only the kernel) and the composition root
 * `packages/features/src/notification-catalog.ts` lists them. Delivery (preferences, inbox
 * rows, email, digests) lives in the notifications feature
 * (docs/guides/how-to-send-notifications.md).
 */
import type { PayloadSchema } from "./job";
import type { RequestContext } from "./request-context";

/** Where a notification can be delivered. */
export const NOTIFICATION_CHANNELS = ["inApp", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** What `render` may use besides the data: the app's public URL, for absolute links. */
export interface NotificationRenderContext {
  /** APP_URL without a trailing slash. */
  readonly appUrl: string;
}

/** A notification in each channel's words. Build `email.html` with the kernel's `html` tag. */
export interface RenderedNotification {
  readonly inApp: {
    readonly title: string;
    readonly body: string;
    /** An app path (`/app/members`) the inbox links to, or null. */
    readonly href: string | null;
  };
  readonly email: {
    readonly subject: string;
    readonly text: string;
    /** The message body only; the notifications feature wraps it in the mail layout. */
    readonly html: string;
  };
}

/** A notification type: its name, data schema, channels and wording. */
export interface NotificationDefinition<TData> {
  /** `<feature>.<name>` in lowercase kebab-case (`workspaces.member-joined`); unique. */
  readonly type: string;
  /** Shown in the preferences matrix ("Someone joins a workspace you manage"). */
  readonly label: string;
  readonly data: PayloadSchema<TData>;
  /** Channels a user gets until they change their preferences. No defaults: state both. */
  readonly defaultChannels: {
    readonly inApp: boolean;
    readonly email: boolean;
  };
  /**
   * Account security (password changed, new sign-in): email is always sent, at once (never
   * in a digest), without an unsubscribe link, and the preferences cannot turn it off. The
   * actor is not dropped from the recipients: they are usually the one to warn.
   */
  readonly securityCritical: boolean;
  /** The wording in each channel. A method, so definitions of any data type fit one catalog. */
  render(data: TData, context: NotificationRenderContext): RenderedNotification;
}

/** Declares a notification type. Lives in the owning feature's `domain/`. */
export function defineNotification<TData>(
  definition: NotificationDefinition<TData>
): NotificationDefinition<TData> {
  return Object.freeze({ ...definition });
}

/** One notification event: who gets it, its data, and the work that caused it. */
export interface NotifyInput<TData> {
  /** User ids. The actor (`requestContext.userId`) is dropped unless security-critical. */
  readonly recipients: readonly string[];
  readonly data: TData;
  readonly context: {
    /** The workspace it is about; the inbox rows cascade with it. Null for account events. */
    readonly workspaceId: string | null;
    readonly requestContext: RequestContext;
  };
}

/**
 * Sends a notification: what use cases receive as `deps.notify`. The app binds the
 * notifications feature's `notify` use case to the job queue; features that the
 * notifications feature depends on (workspaces, accounts) cannot import it directly.
 */
export type Notify = <TData>(
  definition: NotificationDefinition<TData>,
  input: NotifyInput<TData>
) => Promise<{ readonly eventId: string; readonly recipients: number }>;
