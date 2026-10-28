import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "../lib/utils";

export interface DescriptionListProps extends HTMLAttributes<HTMLDListElement> {
  /** `horizontal`: label column + value column (property panel). `vertical`: label above value. */
  readonly orientation?: "horizontal" | "vertical";
  /** Width of the label column in horizontal mode (any CSS length). */
  readonly labelWidth?: string;
  readonly ref?: Ref<HTMLDListElement>;
}

/**
 * Key–value pairs, like the property panel in Linear's issue sidebar: a muted label
 * column and a value column. Values can be plain text or interactive controls (ghost
 * buttons that open pickers).
 */
export function DescriptionList({
  orientation = "horizontal",
  labelWidth = "6.5rem",
  className,
  style,
  ...props
}: DescriptionListProps) {
  return (
    <dl
      data-orientation={orientation}
      style={{ "--dl-label-width": labelWidth, ...style } as CSSProperties}
      className={cn(
        "group/dl text-sm",
        orientation === "horizontal"
          ? "grid grid-cols-[var(--dl-label-width)_minmax(0,1fr)] gap-x-3"
          : "flex flex-col gap-3",
        className
      )}
      {...props}
    />
  );
}

export interface DescriptionItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  readonly label: ReactNode;
  /** The value. Render `—` style placeholders yourself for empty values. */
  readonly children: ReactNode;
}

/** One label + value row of a DescriptionList. */
export function DescriptionItem({
  label,
  children,
  className,
  ...props
}: DescriptionItemProps) {
  return (
    <div
      className={cn(
        "group-data-[orientation=horizontal]/dl:col-span-2 group-data-[orientation=horizontal]/dl:grid group-data-[orientation=horizontal]/dl:grid-cols-subgrid",
        "group-data-[orientation=horizontal]/dl:min-h-8 group-data-[orientation=horizontal]/dl:items-center",
        "group-data-[orientation=vertical]/dl:flex group-data-[orientation=vertical]/dl:flex-col group-data-[orientation=vertical]/dl:gap-1",
        className
      )}
      {...props}
    >
      <dt className="truncate text-fg-muted group-data-[orientation=vertical]/dl:text-xs">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-fg">{children}</dd>
    </div>
  );
}
