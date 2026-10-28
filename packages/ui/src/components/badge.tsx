import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes, ReactNode, Ref } from "react";

import { cn } from "../lib/utils";

/** The semantic colours a badge, tag or avatar can take. All come from theme tokens. */
export type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

export const tones: readonly Tone[] = [
  "neutral",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
];

/** Background colour of a small colour dot per tone (labels, status, legends). */
export const toneDot: Record<Tone, string> = {
  neutral: "bg-fg-subtle",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export const badgeVariants = cva(
  [
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md font-medium",
    "[&_svg]:shrink-0",
  ],
  {
    variants: {
      tone: {
        neutral: "",
        accent: "",
        success: "",
        warning: "",
        danger: "",
        info: "",
      },
      variant: {
        /** Strong emphasis: counts, "New", blocking states. */
        solid: "",
        /** Default: tinted background, coloured text. */
        subtle: "",
        /** Quiet: a hairline border, for dense tables. */
        outline: "border bg-transparent",
      },
      size: {
        sm: "h-4 px-1 text-2xs [&_svg]:size-3",
        md: "h-5 px-1.5 text-xs [&_svg]:size-3.5",
      },
    },
    compoundVariants: [
      { variant: "solid", tone: "neutral", className: "bg-fg text-canvas" },
      {
        variant: "solid",
        tone: "accent",
        className: "bg-accent text-accent-fg",
      },
      {
        variant: "solid",
        tone: "success",
        className: "bg-success-solid text-on-solid",
      },
      {
        variant: "solid",
        tone: "warning",
        className: "bg-warning-solid text-on-solid",
      },
      {
        variant: "solid",
        tone: "danger",
        className: "bg-danger-solid text-on-solid",
      },
      {
        variant: "solid",
        tone: "info",
        className: "bg-info-solid text-on-solid",
      },
      {
        variant: "subtle",
        tone: "neutral",
        className: "bg-hover text-fg-muted",
      },
      {
        variant: "subtle",
        tone: "accent",
        className: "bg-accent-subtle text-accent-text",
      },
      {
        variant: "subtle",
        tone: "success",
        className: "bg-success-subtle text-success",
      },
      {
        variant: "subtle",
        tone: "warning",
        className: "bg-warning-subtle text-warning",
      },
      {
        variant: "subtle",
        tone: "danger",
        className: "bg-danger-subtle text-danger",
      },
      {
        variant: "subtle",
        tone: "info",
        className: "bg-info-subtle text-info",
      },
      {
        variant: "outline",
        tone: "neutral",
        className: "border-line text-fg-muted",
      },
      {
        variant: "outline",
        tone: "accent",
        className: "border-accent/40 text-accent-text",
      },
      {
        variant: "outline",
        tone: "success",
        className: "border-success/40 text-success",
      },
      {
        variant: "outline",
        tone: "warning",
        className: "border-warning/40 text-warning",
      },
      {
        variant: "outline",
        tone: "danger",
        className: "border-danger/40 text-danger",
      },
      {
        variant: "outline",
        tone: "info",
        className: "border-info/40 text-info",
      },
    ],
    defaultVariants: { tone: "neutral", variant: "subtle", size: "md" },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** A small dot in the current colour before the text. */
  readonly dot?: boolean;
  /** Icon before the text (ignored when `dot` is set). */
  readonly icon?: ReactNode;
  readonly ref?: Ref<HTMLSpanElement>;
}

/**
 * A small non-interactive label for a state or a count: "Beta", "3", "Blocked".
 * Pick the tone by meaning, not by looks; `subtle` is the default and fits most places.
 */
export function Badge({
  tone,
  variant,
  size,
  dot = false,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ tone, variant, size }), className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      ) : (
        icon
      )}
      {children}
    </span>
  );
}
