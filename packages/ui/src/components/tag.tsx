import { X } from "lucide-react";
import type { HTMLAttributes, ReactNode, Ref } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";
import { type Tone, toneDot } from "./badge";

const tagSize = {
  sm: "h-5 gap-1 px-1.5 text-2xs [&_svg]:size-3",
  md: "h-6 gap-1.5 px-2 text-xs [&_svg]:size-3.5",
} as const;

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** Colour of the leading dot, like a Linear label. Omit for no dot. */
  readonly color?: Tone;
  /** Icon before the text (instead of the dot). */
  readonly icon?: ReactNode;
  readonly size?: keyof typeof tagSize;
  /** Shows a remove button; called when it is clicked (or Backspace is pressed on it). */
  readonly onRemove?: () => void;
  /** Accessible name of the remove button. Defaults to "Remove <text>". */
  readonly removeLabel?: string;
  readonly ref?: Ref<HTMLSpanElement>;
}

/**
 * A label chip: issue labels, filters, selected values in a multi-select. With
 * `onRemove` it gets a small × button.
 */
export function Tag({
  color,
  icon,
  size = "md",
  onRemove,
  removeLabel,
  className,
  children,
  ...props
}: TagProps) {
  const name = typeof children === "string" ? children : "tag";

  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center rounded-full border border-line bg-transparent font-medium text-fg-muted",
        "[&_svg]:shrink-0",
        tagSize[size],
        onRemove && "pr-0.5",
        className
      )}
      {...props}
    >
      {icon ??
        (color ? (
          <span
            aria-hidden
            className={cn("size-2 shrink-0 rounded-full", toneDot[color])}
          />
        ) : null)}
      <span className="truncate text-fg">{children}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${name}`}
          onClick={onRemove}
          onKeyDown={(event) => {
            if (event.key === "Backspace" || event.key === "Delete") {
              event.preventDefault();
              onRemove();
            }
          }}
          className={cn(
            "inline-flex items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-hover hover:text-fg",
            size === "sm" ? "size-4" : "size-5",
            focusRing
          )}
        >
          <X />
        </button>
      ) : null}
    </span>
  );
}
