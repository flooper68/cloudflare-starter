import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

/** A bordered panel. Interactive cards add `interactive` for hover feedback. */
export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { readonly interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface-raised p-4 text-fg shadow-raised",
        interactive &&
          "cursor-pointer transition-colors hover:border-line-strong hover:bg-hover",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight text-fg",
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-fg-muted", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pt-3", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "-mx-4 -mb-4 mt-4 flex items-center gap-2 border-t border-line px-4 py-3",
        className
      )}
      {...props}
    />
  );
}
