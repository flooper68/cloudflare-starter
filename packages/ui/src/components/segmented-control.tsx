import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { useControllableState } from "radix-ui/internal";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

const rootSize = {
  sm: "h-7",
  md: "h-8",
} as const;

const itemSize = {
  sm: "px-2 text-xs [&_svg]:size-3.5",
  md: "px-2.5 text-sm [&_svg]:size-4",
} as const;

const SizeContext = createContext<keyof typeof rootSize>("md");

export interface SegmentedControlProps
  extends Omit<
    ComponentProps<typeof ToggleGroupPrimitive.Root>,
    "type" | "value" | "defaultValue" | "onValueChange"
  > {
  readonly value?: string;
  readonly defaultValue?: string;
  /** Never called with an empty value: one segment always stays selected. */
  readonly onValueChange?: (value: string) => void;
  readonly size?: keyof typeof rootSize;
}

/**
 * Switch between a few views or modes (List / Board / Timeline), Linear-style: a sunken
 * track with the active segment raised. Arrow keys move between segments.
 */
export function SegmentedControl({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  size = "md",
  className,
  children,
  ...props
}: SegmentedControlProps) {
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });

  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      // Clicking the active segment would clear it; keep the current one instead.
      onValueChange={(next) => {
        if (next) setValue(next);
      }}
      className={cn(
        "inline-flex items-stretch gap-0.5 rounded-md border border-line bg-input p-0.5",
        rootSize[size],
        className
      )}
      {...props}
    >
      <SizeContext value={size}>{children}</SizeContext>
    </ToggleGroupPrimitive.Root>
  );
}

export interface SegmentedControlItemProps
  extends ComponentProps<typeof ToggleGroupPrimitive.Item> {
  readonly icon?: ReactNode;
  /** Accessible name when the segment shows only an icon. */
  readonly label?: string;
}

export function SegmentedControlItem({
  icon,
  label,
  className,
  children,
  ...props
}: SegmentedControlItemProps) {
  const size = useContext(SizeContext);
  return (
    <ToggleGroupPrimitive.Item
      aria-label={label}
      title={children ? undefined : label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-sm font-medium text-fg-muted",
        "transition-[background-color,color,box-shadow] duration-100 hover:text-fg",
        "data-[state=on]:bg-surface-raised data-[state=on]:text-fg data-[state=on]:shadow-raised",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
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
