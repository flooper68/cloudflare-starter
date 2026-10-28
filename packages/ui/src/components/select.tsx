import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import {
  controlBase,
  controlSize,
  menuItem,
  menuLabel,
  menuSeparator,
  overlayContent,
} from "../lib/styles";
import { cn } from "../lib/utils";
import type { FieldControlProps } from "./combobox";

export const SelectRoot = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps
  extends ComponentProps<typeof SelectPrimitive.Trigger> {
  readonly size?: keyof typeof controlSize;
}

/** The closed select; same heights as Input (`sm`, `md`, `lg`). */
export function SelectTrigger({
  size = "md",
  className,
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        controlBase,
        controlSize[size],
        "flex items-center justify-between gap-2 text-left data-[placeholder]:text-fg-subtle",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        "[&>span]:flex [&>span]:min-w-0 [&>span]:items-center [&>span]:gap-2 [&>span]:truncate",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden className="text-fg-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

const scrollButton =
  "flex h-6 cursor-default items-center justify-center text-fg-muted [&_svg]:size-4";

/** The floating list, positioned under the trigger and at least as wide. */
export function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={sideOffset}
        className={cn(
          overlayContent,
          "relative max-h-(--radix-select-content-available-height) min-w-40 overflow-hidden",
          position === "popper" && "min-w-(--radix-select-trigger-width)",
          className
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className={scrollButton}>
          <ChevronUp aria-hidden />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1">
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className={scrollButton}>
          <ChevronDown aria-hidden />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export interface SelectItemProps
  extends ComponentProps<typeof SelectPrimitive.Item> {
  /** Shown before the text, in the list and in the trigger once selected. */
  readonly icon?: ReactNode;
  /** Secondary text in the list only (e.g. a shortcut or count). */
  readonly description?: ReactNode;
}

/** An option; the selected one gets a check mark. */
export function SelectItem({
  icon,
  description,
  className,
  children,
  ...props
}: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(menuItem, "pr-8", className)}
      {...props}
    >
      <SelectPrimitive.ItemText>
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{children}</span>
        </span>
      </SelectPrimitive.ItemText>
      {description ? (
        <span className="ml-auto shrink-0 text-fg-subtle text-xs">
          {description}
        </span>
      ) : null}
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <Check aria-hidden className="text-fg!" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label className={cn(menuLabel, className)} {...props} />
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn(menuSeparator, className)}
      {...props}
    />
  );
}

export interface SelectProps
  extends FieldControlProps,
    Omit<ComponentProps<typeof SelectPrimitive.Root>, "children"> {
  readonly placeholder?: ReactNode;
  readonly size?: keyof typeof controlSize;
  readonly className?: string;
  readonly contentClassName?: string;
  /** SelectItem, SelectGroup, SelectLabel and SelectSeparator elements. */
  readonly children: ReactNode;
}

/**
 * A native-feeling select (Radix Select) styled like Linear's menus: trigger, list, check on
 * the selected item. Compose `SelectItem`s, optionally in `SelectGroup`s with a `SelectLabel`.
 * For long or searchable lists use Combobox. Works inside `<Field>`; for a custom trigger use
 * the parts (`SelectRoot`, `SelectTrigger`, `SelectValue`, `SelectContent`).
 */
export function Select({
  placeholder,
  size,
  className,
  contentClassName,
  children,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rootProps
}: SelectProps) {
  return (
    <SelectPrimitive.Root {...rootProps}>
      <SelectTrigger
        id={id}
        size={size}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={className}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>{children}</SelectContent>
    </SelectPrimitive.Root>
  );
}
