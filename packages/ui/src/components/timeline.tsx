import { format, formatDistanceToNowStrict } from "date-fns";
import type { HTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "../lib/utils";

export interface RelativeTimeProps
  extends Omit<HTMLAttributes<HTMLTimeElement>, "children"> {
  readonly date: Date | string | number;
}

/** "3 hours ago", with the exact date and time as a hover title. */
export function RelativeTime({ date, className, ...props }: RelativeTimeProps) {
  const value = date instanceof Date ? date : new Date(date);
  return (
    <time
      dateTime={value.toISOString()}
      title={format(value, "MMM d, yyyy, h:mm a")}
      className={cn("whitespace-nowrap text-fg-subtle", className)}
      {...props}
    >
      {formatDistanceToNowStrict(value, { addSuffix: true })}
    </time>
  );
}

export interface TimelineProps extends HTMLAttributes<HTMLOListElement> {
  readonly ref?: Ref<HTMLOListElement>;
}

/**
 * An activity feed: a vertical line of events (status changes, assignments) and
 * comments, oldest first, like the activity section of a Linear issue.
 */
export function Timeline({ className, ...props }: TimelineProps) {
  return <ol className={cn("flex flex-col", className)} {...props} />;
}

export interface TimelineItemProps
  extends Omit<HTMLAttributes<HTMLLIElement>, "children"> {
  /** Avatar of the actor or a small icon (status glyph, tag icon). */
  readonly icon: ReactNode;
  /** The event sentence; wrap actors and values in <strong>. */
  readonly children: ReactNode;
  /** When it happened. */
  readonly time?: Date | string | number;
  /** Hide the connecting line below (set on the last item). */
  readonly last?: boolean;
}

/** A one-line event: "**Ada** changed status from Todo to In Progress · 2 hours ago". */
export function TimelineItem({
  icon,
  children,
  time,
  last = false,
  className,
  ...props
}: TimelineItemProps) {
  return (
    <li className={cn("relative flex gap-3 pb-4", className)} {...props}>
      {last ? null : (
        <span
          aria-hidden
          className="absolute top-6 bottom-0 left-2.5 w-px -translate-x-1/2 bg-line"
        />
      )}
      <span className="relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full text-fg-muted [&_svg]:size-3.5">
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-px text-sm text-fg-muted [&_strong]:font-medium [&_strong]:text-fg">
        {children}
        {time !== undefined ? (
          <>
            <span aria-hidden className="mx-1.5 text-fg-subtle">
              ·
            </span>
            <RelativeTime date={time} />
          </>
        ) : null}
      </div>
    </li>
  );
}

export interface TimelineCommentProps
  extends Omit<HTMLAttributes<HTMLLIElement>, "children"> {
  /** The author's Avatar. */
  readonly avatar: ReactNode;
  readonly author: ReactNode;
  readonly time?: Date | string | number;
  /** The comment body. */
  readonly children: ReactNode;
  /** Reactions, reply button, etc. under the body. */
  readonly footer?: ReactNode;
  readonly last?: boolean;
}

/** A comment in the feed: author, time and the body in a bordered bubble. */
export function TimelineComment({
  avatar,
  author,
  time,
  children,
  footer,
  last = false,
  className,
  ...props
}: TimelineCommentProps) {
  return (
    <li className={cn("relative flex gap-3 pb-4", className)} {...props}>
      {last ? null : (
        <span
          aria-hidden
          className="absolute top-6 bottom-0 left-2.5 w-px -translate-x-1/2 bg-line"
        />
      )}
      <span className="relative z-10 flex size-5 shrink-0 items-center justify-center">
        {avatar}
      </span>
      <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface-raised px-3 py-2.5 shadow-raised">
        <div className="mb-1 flex items-center gap-1.5 text-sm">
          <span className="font-medium text-fg">{author}</span>
          {time !== undefined ? (
            <RelativeTime date={time} className="text-xs" />
          ) : null}
        </div>
        <div className="text-sm text-fg [&_p+p]:mt-2">{children}</div>
        {footer ? (
          <div className="mt-2 flex items-center gap-1.5">{footer}</div>
        ) : null}
      </div>
    </li>
  );
}
