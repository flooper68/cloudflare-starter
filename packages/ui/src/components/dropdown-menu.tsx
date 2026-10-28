import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronRight, Circle } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import {
  menuItem,
  menuLabel,
  menuSeparator,
  overlayContent,
} from "../lib/styles";
import { cn } from "../lib/utils";
import { Shortcut } from "./kbd";

/** Menu panel classes, shared by DropdownMenu and ContextMenu. */
export const menuContent = cn(overlayContent, "min-w-48 overflow-y-auto p-1");

/** Menu row classes with tones, shared by DropdownMenu and ContextMenu. */
export const menuItemVariants = cva(menuItem, {
  variants: {
    tone: {
      default: "",
      /** Destructive actions: red text and icon, red tint on highlight. */
      danger:
        "text-danger data-[highlighted]:bg-danger-subtle [&_svg]:text-danger",
    },
    /** Indents a row without an icon so its text lines up with rows that have one. */
    inset: { true: "pl-8", false: "" },
  },
  defaultVariants: { tone: "default", inset: false },
});

/** Keyboard shortcut at the end of a menu row. */
export function MenuShortcut({ keys }: { readonly keys: readonly string[] }) {
  return <Shortcut keys={keys} className="ml-auto pl-4" />;
}

export interface MenuItemSlotsProps {
  /** Icon before the label (16px, muted). */
  readonly icon?: ReactNode;
  /** Shortcut keys shown at the end, e.g. ["⌘", "D"]. */
  readonly shortcut?: readonly string[];
}

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/**
 * A menu of actions opened from a button (the "…" menu on an issue). Items take an `icon`,
 * a `shortcut` and `tone="danger"`; there are checkbox items, radio items and submenus.
 * Full keyboard support: arrows, type-ahead, Enter, Escape.
 */
export function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          menuContent,
          "max-h-(--radix-dropdown-menu-content-available-height)",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps
  extends ComponentProps<typeof DropdownMenuPrimitive.Item>,
    VariantProps<typeof menuItemVariants>,
    MenuItemSlotsProps {}

export function DropdownMenuItem({
  className,
  tone,
  inset,
  icon,
  shortcut,
  children,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(menuItemVariants({ tone, inset }), className)}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      {shortcut ? <MenuShortcut keys={shortcut} /> : null}
    </DropdownMenuPrimitive.Item>
  );
}

export interface DropdownMenuCheckboxItemProps
  extends ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>,
    MenuItemSlotsProps {}

/** A toggle; the check sits where the icon would, so labels line up. */
export function DropdownMenuCheckboxItem({
  className,
  shortcut,
  children,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(menuItemVariants({ inset: true }), className)}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="text-fg!" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <span className="truncate">{children}</span>
      {shortcut ? <MenuShortcut keys={shortcut} /> : null}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export interface DropdownMenuRadioItemProps
  extends ComponentProps<typeof DropdownMenuPrimitive.RadioItem>,
    MenuItemSlotsProps {}

/** One option of a DropdownMenuRadioGroup. */
export function DropdownMenuRadioItem({
  className,
  shortcut,
  children,
  ...props
}: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(menuItemVariants({ inset: true }), className)}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2! fill-current text-accent!" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      <span className="truncate">{children}</span>
      {shortcut ? <MenuShortcut keys={shortcut} /> : null}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(menuLabel, className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn(menuSeparator, className)}
      {...props}
    />
  );
}

export interface DropdownMenuSubTriggerProps
  extends ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> {
  readonly icon?: ReactNode;
}

/** Opens a submenu on hover or →. */
export function DropdownMenuSubTrigger({
  className,
  icon,
  children,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(menuItem, "data-[state=open]:bg-hover", className)}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      <ChevronRight className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        sideOffset={sideOffset}
        className={cn(menuContent, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}
