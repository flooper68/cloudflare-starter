import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import { Shortcut } from "./kbd";

/** Wrap the app once; tooltips share the delay (opening a second one is instant). */
export function TooltipProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface TooltipProps {
  readonly content: ReactNode;
  /** Keyboard shortcut shown after the text, Linear-style. */
  readonly shortcut?: readonly string[];
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly children: ReactNode;
  readonly className?: string;
}

/** A short hint on hover or focus. The child must be focusable (button, link). */
export function Tooltip({
  content,
  shortcut,
  side = "top",
  children,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 flex items-center gap-2 rounded-md border border-line bg-overlay px-2 py-1 text-xs text-fg shadow-overlay",
            "data-[state=delayed-open]:animate-fade-in data-[state=closed]:animate-fade-out",
            className
          )}
        >
          {content}
          {shortcut ? <Shortcut keys={shortcut} /> : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
