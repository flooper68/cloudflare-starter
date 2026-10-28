import { cva, type VariantProps } from "class-variance-authority";
import { ArrowUpRight } from "lucide-react";
import { Slot } from "radix-ui";
import type { AnchorHTMLAttributes, Ref } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

export const linkVariants = cva(
  [
    "inline-flex items-baseline gap-0.5 rounded-sm underline-offset-4 transition-colors duration-100",
    focusRing,
  ],
  {
    variants: {
      variant: {
        /** Accent text, underline on hover: links in running text. */
        default: "text-accent hover:underline",
        /** Body colour with an underline: links inside dense text where accent is too loud. */
        subtle:
          "text-fg underline decoration-line-strong hover:decoration-fg-muted",
        /** Muted, for footers and secondary metadata. */
        muted: "text-fg-muted hover:text-fg hover:underline",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface LinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof linkVariants> {
  /** Opens in a new tab with `rel="noopener noreferrer"` and shows an ↗ icon. */
  readonly external?: boolean;
  /** Render the child (e.g. a router `<Link>`) with link styles. */
  readonly asChild?: boolean;
  readonly ref?: Ref<HTMLAnchorElement>;
}

/** An inline text link. Use `external` for other sites; `asChild` for router links. */
export function Link({
  variant,
  external = false,
  asChild = false,
  className,
  children,
  target,
  rel,
  ...props
}: LinkProps) {
  const classes = cn(linkVariants({ variant }), className);

  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <a
      className={classes}
      target={external ? (target ?? "_blank") : target}
      rel={external ? (rel ?? "noopener noreferrer") : rel}
      {...props}
    >
      {children}
      {external ? (
        <>
          <ArrowUpRight
            aria-hidden
            className="size-3.5 shrink-0 self-center opacity-70"
          />
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      ) : null}
    </a>
  );
}
