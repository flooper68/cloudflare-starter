import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

/** A keyboard key, e.g. <Kbd>⌘</Kbd><Kbd>K</Kbd>. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-surface-raised px-1",
        "font-sans text-2xs font-medium text-fg-muted",
        className
      )}
      {...props}
    />
  );
}

/** A shortcut as keys: <Shortcut keys={["⌘", "K"]} />. */
export function Shortcut({
  keys,
  className,
}: {
  readonly keys: readonly string[];
  readonly className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}
