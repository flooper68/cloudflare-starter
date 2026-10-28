import { AlertTriangle, CircleCheck, CircleX, Info, X } from "lucide-react";
import {
  Toaster as SonnerToaster,
  type ToasterProps as SonnerToasterProps,
} from "sonner";

import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import { Spinner } from "./spinner";

/**
 * `toast("Issue created")`, `toast.success(...)`, `toast.error(...)`, `toast.info(...)`,
 * `toast.warning(...)`, `toast.loading(...)`, `toast.promise(promise, { loading, success, error })`
 * and `toast.dismiss(id)`. Options: `description`, `action: { label, onClick }`, `duration`.
 */
export { toast } from "sonner";

export interface ToasterProps
  extends Omit<SonnerToasterProps, "theme" | "richColors" | "icons"> {}

/**
 * Renders the toasts. Mount once at the app root. Compact Linear-style cards in the
 * bottom-right corner, themed by tokens (follows the light/dark theme automatically).
 */
export function Toaster({
  position = "bottom-right",
  gap = 8,
  visibleToasts = 4,
  toastOptions,
  ...props
}: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      gap={gap}
      visibleToasts={visibleToasts}
      icons={{
        success: <CircleCheck className="size-4 text-success" />,
        error: <CircleX className="size-4 text-danger" />,
        info: <Info className="size-4 text-info" />,
        warning: <AlertTriangle className="size-4 text-warning" />,
        loading: <Spinner className="text-fg-muted" />,
        close: <X className="size-3" />,
      }}
      toastOptions={{
        ...toastOptions,
        unstyled: true,
        classNames: {
          toast: cn(
            "group flex w-(--width) items-start gap-2.5 rounded-lg border border-line bg-overlay p-3",
            "font-sans text-sm text-fg shadow-overlay"
          ),
          icon: "mt-0.5 flex size-4 shrink-0 items-center justify-center",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "font-medium leading-5 text-fg",
          description: "text-xs text-fg-muted",
          actionButton: cn(
            buttonVariants({ variant: "secondary", size: "xs" }),
            "ml-1 self-center"
          ),
          cancelButton: cn(
            buttonVariants({ variant: "ghost", size: "xs" }),
            "self-center"
          ),
          closeButton: cn(
            "absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full",
            "border border-line bg-overlay text-fg-muted opacity-0 transition-opacity",
            "group-hover:opacity-100 hover:text-fg focus-visible:opacity-100"
          ),
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}
