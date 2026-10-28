import type { VariantProps } from "class-variance-authority";
import { Check, ChevronRight, Circle } from "lucide-react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";

import { menuItem, menuLabel, menuSeparator } from "../lib/styles";
import { cn } from "../lib/utils";
import {
  type MenuItemSlotsProps,
  MenuShortcut,
  menuContent,
  menuItemVariants,
} from "./dropdown-menu";

export const ContextMenu = ContextMenuPrimitive.Root;
/** The area that opens the menu on right-click (or long-press on touch). */
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
export const ContextMenuGroup = ContextMenuPrimitive.Group;
export const ContextMenuSub = ContextMenuPrimitive.Sub;
export const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

/**
 * The right-click menu. Same rows as DropdownMenu (icon, shortcut, `tone="danger"`,
 * checkbox, radio, submenus), opened at the pointer instead of from a button.
 */
export function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        className={cn(
          menuContent,
          "max-h-(--radix-context-menu-content-available-height)",
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

export interface ContextMenuItemProps
  extends ComponentProps<typeof ContextMenuPrimitive.Item>,
    VariantProps<typeof menuItemVariants>,
    MenuItemSlotsProps {}

export function ContextMenuItem({
  className,
  tone,
  inset,
  icon,
  shortcut,
  children,
  ...props
}: ContextMenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(menuItemVariants({ tone, inset }), className)}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      {shortcut ? <MenuShortcut keys={shortcut} /> : null}
    </ContextMenuPrimitive.Item>
  );
}

export interface ContextMenuCheckboxItemProps
  extends ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>,
    MenuItemSlotsProps {}

export function ContextMenuCheckboxItem({
  className,
  shortcut,
  children,
  ...props
}: ContextMenuCheckboxItemProps) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      className={cn(menuItemVariants({ inset: true }), className)}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Check className="text-fg!" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      <span className="truncate">{children}</span>
      {shortcut ? <MenuShortcut keys={shortcut} /> : null}
    </ContextMenuPrimitive.CheckboxItem>
  );
}

export interface ContextMenuRadioItemProps
  extends ComponentProps<typeof ContextMenuPrimitive.RadioItem>,
    MenuItemSlotsProps {}

export function ContextMenuRadioItem({
  className,
  shortcut,
  children,
  ...props
}: ContextMenuRadioItemProps) {
  return (
    <ContextMenuPrimitive.RadioItem
      className={cn(menuItemVariants({ inset: true }), className)}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <Circle className="size-2! fill-current text-accent!" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
      <span className="truncate">{children}</span>
      {shortcut ? <MenuShortcut keys={shortcut} /> : null}
    </ContextMenuPrimitive.RadioItem>
  );
}

export function ContextMenuLabel({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Label>) {
  return (
    <ContextMenuPrimitive.Label
      className={cn(menuLabel, className)}
      {...props}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn(menuSeparator, className)}
      {...props}
    />
  );
}

export interface ContextMenuSubTriggerProps
  extends ComponentProps<typeof ContextMenuPrimitive.SubTrigger> {
  readonly icon?: ReactNode;
}

export function ContextMenuSubTrigger({
  className,
  icon,
  children,
  ...props
}: ContextMenuSubTriggerProps) {
  return (
    <ContextMenuPrimitive.SubTrigger
      className={cn(menuItem, "data-[state=open]:bg-hover", className)}
      {...props}
    >
      {icon}
      <span className="truncate">{children}</span>
      <ChevronRight className="ml-auto" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

export function ContextMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.SubContent
        className={cn(menuContent, className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}
