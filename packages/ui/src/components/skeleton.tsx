import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

/**
 * A placeholder block that pulses while content loads. Size it with classes, or use a
 * preset: SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonListRow. Put `aria-busy`
 * on the region that is loading.
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-md bg-hover", className)}
      {...props}
    />
  );
}

const lineWidths = ["w-full", "w-11/12", "w-4/5", "w-full", "w-3/4"];

export interface SkeletonTextProps {
  /** Number of lines; the last one is shorter. */
  readonly lines?: number;
  readonly className?: string;
}

/** Lines of body text. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          key={index}
          className={cn(
            "h-3",
            index === lines - 1 && lines > 1
              ? "w-3/5"
              : lineWidths[index % lineWidths.length]
          )}
        />
      ))}
    </div>
  );
}

const avatarSize = {
  xs: "size-4",
  sm: "size-5",
  md: "size-6",
  lg: "size-8",
  xl: "size-10",
};

export interface SkeletonAvatarProps {
  readonly size?: keyof typeof avatarSize;
  readonly className?: string;
}

/** A round placeholder for an avatar. */
export function SkeletonAvatar({
  size = "md",
  className,
}: SkeletonAvatarProps) {
  return (
    <Skeleton
      className={cn("shrink-0 rounded-full", avatarSize[size], className)}
    />
  );
}

/** A card with a header (avatar, title) and a few lines of text. */
export function SkeletonCard({ className }: { readonly className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="lg" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

/** One row of an issue list: status, id, title, assignee. */
export function SkeletonListRow({
  className,
}: {
  readonly className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("flex h-10 items-center gap-3 px-3", className)}
    >
      <Skeleton className="size-3.5 shrink-0 rounded-full" />
      <Skeleton className="h-3 w-14 shrink-0" />
      <Skeleton className="h-3 flex-1" />
      <SkeletonAvatar size="sm" />
    </div>
  );
}
