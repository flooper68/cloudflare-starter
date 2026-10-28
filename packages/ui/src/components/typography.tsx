import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

const headingVariants = cva("font-semibold tracking-tight text-fg", {
  variants: {
    level: {
      1: "text-2xl",
      2: "text-xl",
      3: "text-lg",
      4: "text-base",
    },
  },
  defaultVariants: { level: 2 },
});

export interface HeadingProps
  extends HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {}

export function Heading({ level = 2, className, ...props }: HeadingProps) {
  const Tag = `h${level ?? 2}` as "h1" | "h2" | "h3" | "h4";
  return (
    <Tag className={cn(headingVariants({ level }), className)} {...props} />
  );
}

const textVariants = cva("", {
  variants: {
    tone: {
      default: "text-fg",
      muted: "text-fg-muted",
      subtle: "text-fg-subtle",
      accent: "text-accent",
      danger: "text-danger",
      success: "text-success",
    },
    size: { xs: "text-xs", sm: "text-sm", base: "text-base", lg: "text-lg" },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
  },
  defaultVariants: { tone: "default", size: "sm", weight: "normal" },
});

export interface TextProps
  extends HTMLAttributes<HTMLParagraphElement>,
    VariantProps<typeof textVariants> {
  readonly as?: "p" | "span" | "div";
}

export function Text({
  as: Tag = "p",
  tone,
  size,
  weight,
  className,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(textVariants({ tone, size, weight }), className)}
      {...props}
    />
  );
}
