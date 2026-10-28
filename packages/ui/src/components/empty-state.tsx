import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils";

const emptyStateVariants = cva("flex flex-col items-center text-center", {
  variants: {
    variant: {
      /** Fills a page or a large panel. */
      page: "mx-auto max-w-sm gap-4 px-6 py-16",
      /** Inside a card, list or popover. */
      compact: "gap-3 px-4 py-8",
    },
  },
  defaultVariants: { variant: "page" },
});

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof emptyStateVariants> {
  /** A lucide icon. */
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** The main way out, usually a primary Button ("Create issue"). */
  readonly primaryAction?: ReactNode;
  /** A secondary or link Button ("Import from GitHub", "Learn more"). */
  readonly secondaryAction?: ReactNode;
}

/**
 * What to show when there is nothing to show: a short reason and the next step. Use
 * `page` for empty views, `compact` for empty lists inside cards or panels.
 */
export function EmptyState({
  variant = "page",
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  ...props
}: EmptyStateProps) {
  const page = variant === "page";
  return (
    <div className={cn(emptyStateVariants({ variant }), className)} {...props}>
      {icon ? (
        <div
          className={cn(
            "flex items-center justify-center text-fg-muted",
            page
              ? "size-12 rounded-xl border border-line bg-surface-raised shadow-raised [&_svg]:size-6"
              : "[&_svg]:size-5"
          )}
        >
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p
          className={cn("font-medium text-fg", page ? "text-base" : "text-sm")}
        >
          {title}
        </p>
        {description ? (
          <p className={cn("text-fg-muted", page ? "text-sm" : "text-xs")}>
            {description}
          </p>
        ) : null}
      </div>
      {primaryAction || secondaryAction ? (
        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-2",
            page && "mt-1"
          )}
        >
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
