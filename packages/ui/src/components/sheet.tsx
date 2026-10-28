import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps, HTMLAttributes } from "react";

import { backdrop } from "../lib/styles";
import { cn } from "../lib/utils";
import { IconButton } from "./button";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

// Only slide-in-right has keyframes in the theme; left and bottom slide in with
// @starting-style and fade out on close.
export const sheetVariants = cva(
  [
    "fixed z-50 flex flex-col bg-overlay text-sm text-fg border-line shadow-overlay outline-none",
  ],
  {
    variants: {
      side: {
        right:
          "inset-y-2 right-2 rounded-xl border data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
        left: "inset-y-2 left-2 rounded-xl border data-[state=open]:animate-slide-in-left data-[state=closed]:animate-slide-out-left",
        bottom:
          "inset-x-2 bottom-2 rounded-xl border data-[state=open]:animate-slide-in-bottom data-[state=closed]:animate-slide-out-bottom",
      },
      size: { sm: "", md: "", lg: "", xl: "" },
    },
    compoundVariants: [
      {
        side: ["right", "left"],
        size: "sm",
        className: "w-[calc(100%-1rem)] max-w-sm",
      },
      {
        side: ["right", "left"],
        size: "md",
        className: "w-[calc(100%-1rem)] max-w-md",
      },
      {
        side: ["right", "left"],
        size: "lg",
        className: "w-[calc(100%-1rem)] max-w-xl",
      },
      {
        side: ["right", "left"],
        size: "xl",
        className: "w-[calc(100%-1rem)] max-w-3xl",
      },
      { side: "bottom", size: "sm", className: "max-h-[30dvh]" },
      { side: "bottom", size: "md", className: "max-h-[50dvh]" },
      { side: "bottom", size: "lg", className: "max-h-[70dvh]" },
      { side: "bottom", size: "xl", className: "max-h-[90dvh]" },
    ],
    defaultVariants: { side: "right", size: "md" },
  }
);

export interface SheetContentProps
  extends ComponentProps<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Shows the × button in the top-right corner. */
  readonly showClose?: boolean;
}

/**
 * A panel that slides in from an edge, for details panes (an issue, a person, settings)
 * that keep the page underneath in context. Compose with SheetHeader, SheetBody, SheetFooter.
 */
export function SheetContent({
  className,
  side,
  size,
  showClose = true,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className={backdrop} />
      <SheetPrimitive.Content
        className={cn(sheetVariants({ side, size }), className)}
        {...props}
      >
        {children}
        {showClose ? (
          <SheetPrimitive.Close asChild>
            <IconButton
              label="Close"
              size="sm"
              className="absolute top-3 right-3"
            >
              <X />
            </IconButton>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1 border-b border-line px-5 py-3 pr-12",
        className
      )}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn(
        "text-base font-semibold tracking-tight text-fg",
        className
      )}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-sm text-fg-muted", className)}
      {...props}
    />
  );
}

/** Scrolls when the content is taller than the sheet. */
export function SheetBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)}
      {...props}
    />
  );
}

export function SheetFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 py-3",
        className
      )}
      {...props}
    />
  );
}
