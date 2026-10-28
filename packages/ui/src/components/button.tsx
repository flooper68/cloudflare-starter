import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium",
    "transition-[background-color,border-color,color,box-shadow] duration-100 select-none",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    "[&_svg]:size-4 [&_svg]:shrink-0",
    focusRing,
  ],
  {
    variants: {
      variant: {
        /** The one main action of a view. */
        primary: "bg-accent text-accent-fg shadow-raised hover:bg-accent-hover",
        /** Everyday actions. */
        secondary:
          "border border-line bg-surface-raised text-fg shadow-raised hover:border-line-strong hover:bg-hover",
        /** Same as secondary; kept for older call sites. */
        outline:
          "border border-line bg-transparent text-fg hover:border-line-strong hover:bg-hover",
        /** Toolbars, menus, low-emphasis actions. */
        ghost: "text-fg-muted hover:bg-hover hover:text-fg",
        /** Destructive confirmations. */
        danger: "bg-danger text-white shadow-raised hover:bg-danger/90",
        /** Inline, looks like a link. */
        link: "h-auto px-0 text-accent underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-6 px-2 text-xs [&_svg]:size-3.5",
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-sm",
        lg: "h-9 px-4 text-sm",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner, disables the button and sets aria-busy. */
  readonly loading?: boolean;
  /** Icon before the label. */
  readonly icon?: ReactNode;
  /** Icon or shortcut after the label. */
  readonly trailing?: ReactNode;
  /** Render the child element (e.g. a link) with button styles. */
  readonly asChild?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  icon,
  trailing,
  asChild = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {trailing}
    </button>
  );
}

const iconButtonSize = {
  xs: "size-6 [&_svg]:size-3.5",
  sm: "size-7",
  md: "size-8",
  lg: "size-9",
} as const;

export interface IconButtonProps
  extends Omit<ButtonProps, "icon" | "trailing" | "asChild" | "children"> {
  /** Required: the button has no visible text. */
  readonly label: string;
  readonly children: ReactNode;
}

/** A square button with only an icon; `label` becomes its accessible name and tooltip. */
export function IconButton({
  label,
  size = "md",
  variant = "ghost",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      size={size}
      className={cn("px-0", iconButtonSize[size ?? "md"], className)}
      {...props}
    >
      {children}
    </Button>
  );
}
