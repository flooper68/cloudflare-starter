import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

const itemSize = {
  sm: "h-7 min-w-7 px-1.5 text-xs",
  md: "h-8 min-w-8 px-2 text-sm",
} as const;

const SizeContext = createContext<keyof typeof itemSize>("md");

export type ToggleGroupProps = ComponentProps<
  typeof ToggleGroupPrimitive.Root
> & {
  readonly size?: keyof typeof itemSize;
};

/**
 * A row of toggle buttons, e.g. Bold / Italic / Strikethrough in a toolbar. `type="multiple"`
 * lets several be on; `type="single"` allows at most one (and none). For switching views,
 * use SegmentedControl.
 */
export function ToggleGroup({
  size = "md",
  className,
  children,
  ...props
}: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    >
      <SizeContext value={size}>{children}</SizeContext>
    </ToggleGroupPrimitive.Root>
  );
}

export interface ToggleGroupItemProps
  extends ComponentProps<typeof ToggleGroupPrimitive.Item> {
  readonly icon?: ReactNode;
  /** Accessible name and tooltip; required when the item shows only an icon. */
  readonly label?: string;
}

export function ToggleGroupItem({
  icon,
  label,
  className,
  children,
  ...props
}: ToggleGroupItemProps) {
  const size = useContext(SizeContext);
  return (
    <ToggleGroupPrimitive.Item
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md text-fg-muted",
        "transition-colors duration-100 hover:bg-hover hover:text-fg",
        "data-[state=on]:bg-active data-[state=on]:text-fg",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        itemSize[size],
        focusRing,
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </ToggleGroupPrimitive.Item>
  );
}
