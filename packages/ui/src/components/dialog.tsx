import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps, HTMLAttributes } from "react";

import { backdrop, focusRing } from "../lib/styles";
import { useKeyboardScrollable } from "../lib/use-keyboard-scrollable";
import { cn } from "../lib/utils";
import { IconButton } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

/** Shared by Dialog and AlertDialog so both modals look the same. */
export const dialogContentVariants = cva(
  [
    "fixed z-50 flex flex-col bg-overlay text-sm text-fg rounded-xl border border-line shadow-overlay",
    "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out outline-none",
  ],
  {
    variants: {
      size: {
        sm: "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-4rem)] -translate-x-1/2 -translate-y-1/2",
        md: "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-4rem)] -translate-x-1/2 -translate-y-1/2",
        lg: "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-4rem)] -translate-x-1/2 -translate-y-1/2",
        xl: "left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-4xl max-h-[calc(100dvh-4rem)] -translate-x-1/2 -translate-y-1/2",
        full: "inset-4",
      },
    },
    defaultVariants: { size: "md" },
  }
);

export interface DialogContentProps
  extends ComponentProps<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  /** Shows the × button in the top-right corner. */
  readonly showClose?: boolean;
}

/**
 * The modal panel: dimmed backdrop, focus trapped inside, Escape and outside click close it.
 * Compose with DialogHeader, DialogBody (scrolls) and DialogFooter.
 */
export function DialogContent({
  className,
  size,
  showClose = true,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={backdrop} />
      <DialogPrimitive.Content
        className={cn(dialogContentVariants({ size }), className)}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <IconButton
              label="Close"
              size="sm"
              className="absolute top-3 right-3"
            >
              <X />
            </IconButton>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Title and description at the top; leaves room for the close button. */
export function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1 px-5 pt-4 pb-3 pr-12",
        className
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "text-base font-semibold tracking-tight text-fg",
        className
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-fg-muted", className)}
      {...props}
    />
  );
}

/**
 * The content area; scrolls when the dialog hits the viewport height. A scrolling body
 * without focusable content becomes a tab stop so the keyboard can scroll it.
 */
export function DialogBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const scrollRef = useKeyboardScrollable<HTMLDivElement>();
  return (
    <div
      ref={scrollRef}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto px-5 py-2",
        focusRing,
        "focus-visible:ring-inset",
        className
      )}
      {...props}
    />
  );
}

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Draws a line above the footer; use it when the body scrolls or is long. */
  readonly separated?: boolean;
}

/** Actions, right-aligned. Put extra content on the left with `mr-auto`. */
export function DialogFooter({
  className,
  separated = false,
  ...props
}: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 px-5 pt-3 pb-4",
        separated && "mt-2 border-t border-line pt-3 pb-3",
        className
      )}
      {...props}
    />
  );
}
