import type { VariantProps } from "class-variance-authority";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";

import { backdrop } from "../lib/styles";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import { DialogFooter, DialogHeader, dialogContentVariants } from "./dialog";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
/** Title and description block; same layout as DialogHeader. */
export const AlertDialogHeader = DialogHeader;
/** Right-aligned actions; same layout as DialogFooter. */
export const AlertDialogFooter = DialogFooter;

export interface AlertDialogContentProps
  extends ComponentProps<typeof AlertDialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

/**
 * A modal that asks for a decision and cannot be dismissed by clicking outside. Use it for
 * destructive or irreversible actions; for everything else use Dialog.
 */
export function AlertDialogContent({
  className,
  size = "sm",
  ...props
}: AlertDialogContentProps) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className={backdrop} />
      <AlertDialogPrimitive.Content
        className={cn(dialogContentVariants({ size }), className)}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn(
        "text-base font-semibold tracking-tight text-fg",
        className
      )}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-sm text-fg-muted", className)}
      {...props}
    />
  );
}

export interface AlertDialogActionProps
  extends ComponentProps<typeof AlertDialogPrimitive.Action> {
  /** `danger` for destructive confirmations. */
  readonly tone?: "default" | "danger";
}

/** The confirming button; closes the dialog. */
export function AlertDialogAction({
  className,
  tone = "default",
  ...props
}: AlertDialogActionProps) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(
        buttonVariants({ variant: tone === "danger" ? "danger" : "primary" }),
        className
      )}
      {...props}
    />
  );
}

/** The cancelling button; receives focus when the dialog opens. */
export function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "secondary" }), className)}
      {...props}
    />
  );
}

export interface ConfirmOptions {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** Label of the confirming button. Default "Confirm". */
  readonly confirmLabel?: string;
  /** Label of the cancelling button. Default "Cancel". */
  readonly cancelLabel?: string;
  /** `danger` paints the confirm button red. */
  readonly tone?: "default" | "danger";
}

export interface ConfirmDialogProps extends ConfirmOptions {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
}

/** A ready-made AlertDialog with a title, description and two buttons. */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <AlertDialogHeader className="pr-5">
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction tone={tone} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface UseConfirmResult {
  /** Opens the dialog and resolves `true` on confirm, `false` on cancel or Escape. */
  readonly confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Render this once, anywhere in the component. */
  readonly dialog: ReactElement;
}

/**
 * `window.confirm()` with the library's look:
 *
 * ```tsx
 * const { confirm, dialog } = useConfirm();
 * if (await confirm({ title: "Delete project?", tone: "danger" })) deleteProject();
 * return <>{dialog}<Button onClick={...}>Delete</Button></>;
 * ```
 */
export function useConfirm(): UseConfirmResult {
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const confirm = useCallback(
    (next: ConfirmOptions) => {
      settle(false);
      setOptions(next);
      setOpen(true);
      return new Promise<boolean>((resolve) => {
        resolver.current = resolve;
      });
    },
    [settle]
  );

  const dialog = (
    <ConfirmDialog
      {...options}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) settle(false);
      }}
      onConfirm={() => settle(true)}
    />
  );

  return { confirm, dialog };
}
