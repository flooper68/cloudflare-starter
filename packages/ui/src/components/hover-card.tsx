import { HoverCard as HoverCardPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { overlayContent } from "../lib/styles";
import { cn } from "../lib/utils";

export interface HoverCardProps
  extends ComponentProps<typeof HoverCardPrimitive.Root> {}

/**
 * A preview that appears while hovering a link (a person, an issue, a project). Sighted
 * mouse users only: put nothing in it that is not also reachable another way.
 */
export function HoverCard({
  openDelay = 500,
  closeDelay = 150,
  ...props
}: HoverCardProps) {
  return (
    <HoverCardPrimitive.Root
      openDelay={openDelay}
      closeDelay={closeDelay}
      {...props}
    />
  );
}

export const HoverCardTrigger = HoverCardPrimitive.Trigger;

export function HoverCardContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(overlayContent, "w-72 p-4", className)}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}
