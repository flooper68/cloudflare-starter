import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { overlayContent } from "../lib/styles";
import { cn } from "../lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

/**
 * Floating panel anchored to its trigger; closes on outside click and Escape. It is a dialog,
 * so give it a name: `aria-label`, or `aria-labelledby` pointing at its heading.
 */
export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(overlayContent, "w-72 p-3", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
