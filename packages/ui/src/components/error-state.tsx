import { cva, type VariantProps } from "class-variance-authority";
import { RotateCw, TriangleAlert } from "lucide-react";
import { type HTMLAttributes, type ReactNode, useState } from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";

const errorStateVariants = cva("flex flex-col", {
  variants: {
    variant: {
      /** Replaces a whole page or large panel that failed to load. */
      page: "mx-auto max-w-sm items-center gap-4 px-6 py-16 text-center",
      /** Inside a card, list, table or popover. */
      compact: "items-center gap-3 px-4 py-8 text-center",
      /** One line, next to the thing that failed (a field, a row, a widget). */
      inline:
        "flex-row items-center gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-left",
    },
  },
  defaultVariants: { variant: "page" },
});

/** A message that is safe to show: the error's own message, or a generic one. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again in a moment."
): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export interface ErrorStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof errorStateVariants> {
  readonly title?: ReactNode;
  /** What went wrong and what the user can do; defaults to the error's message. */
  readonly description?: ReactNode;
  /** The caught error; its message is the default description. */
  readonly error?: unknown;
  /** Shows "Try again"; may return a promise (the button spins until it settles). */
  readonly onRetry?: () => unknown;
  /** Another way out ("Go to dashboard", "Contact support"). */
  readonly secondaryAction?: ReactNode;
  /** Technical details (status code, request path) in a collapsed section. */
  readonly details?: ReactNode;
  /**
   * The server's reference for this failure (the trace id), shown as text the user can
   * select and quote to support. Pass it for unexpected (500) errors.
   */
  readonly reference?: string;
}

function Reference({ value }: { readonly value: string }) {
  return (
    <span className="text-xs text-fg-muted">
      Reference <code className="select-all font-mono text-fg">{value}</code>
    </span>
  );
}

/**
 * What to show when something failed to load or save: what happened, and a way forward
 * (retry, or somewhere else to go). Never a blank area or a raw stack trace. Use `page`
 * for failed views, `compact` inside cards and lists, `inline` next to a single widget.
 */
export function ErrorState({
  variant = "page",
  title = "Couldn't load this",
  description,
  error,
  onRetry,
  secondaryAction,
  details,
  reference,
  className,
  ...props
}: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);
  const message = description ?? (error ? errorMessage(error) : undefined);

  async function retry() {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  const retryButton = onRetry ? (
    <Button
      size={variant === "inline" ? "xs" : "sm"}
      variant={variant === "page" ? "secondary" : "ghost"}
      icon={<RotateCw />}
      loading={retrying}
      onClick={() => void retry()}
    >
      Try again
    </Button>
  ) : null;

  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={cn(errorStateVariants({ variant }), className)}
        {...props}
      >
        <TriangleAlert className="size-4 shrink-0 text-danger" />
        <span className="flex min-w-0 flex-1 flex-col text-sm text-fg">
          {message ?? title}
          {reference ? <Reference value={reference} /> : null}
        </span>
        {retryButton}
      </div>
    );
  }

  const page = variant === "page";
  return (
    <div
      role="alert"
      className={cn(errorStateVariants({ variant }), className)}
      {...props}
    >
      <div
        className={cn(
          "flex items-center justify-center text-danger",
          page
            ? "size-12 rounded-xl border border-danger/30 bg-danger-subtle [&_svg]:size-6"
            : "[&_svg]:size-5"
        )}
      >
        <TriangleAlert />
      </div>
      <div className="flex flex-col gap-1">
        <p
          className={cn("font-medium text-fg", page ? "text-base" : "text-sm")}
        >
          {title}
        </p>
        {message ? (
          <p className={cn("text-fg-muted", page ? "text-sm" : "text-xs")}>
            {message}
          </p>
        ) : null}
        {reference ? <Reference value={reference} /> : null}
      </div>
      {retryButton || secondaryAction ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {retryButton}
          {secondaryAction}
        </div>
      ) : null}
      {details ? (
        <details className="w-full text-left text-xs text-fg-subtle">
          <summary className="cursor-pointer select-none text-center hover:text-fg-muted">
            Details
          </summary>
          <div className="mt-2 rounded-md border border-line bg-surface p-2 font-mono break-all">
            {details}
          </div>
        </details>
      ) : null}
    </div>
  );
}
