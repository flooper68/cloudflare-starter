import { type HTMLAttributes, type ReactNode, useId } from "react";

import { cn } from "../lib/utils";

export interface Feature {
  readonly title: string;
  readonly description: ReactNode;
  /** A lucide icon; ignored when the grid is `numbered`. */
  readonly icon?: ReactNode;
}

export interface FeatureGridProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly features: readonly Feature[];
  /** Steps in order: an ordered list with 01, 02, … instead of icons. */
  readonly numbered?: boolean;
}

/**
 * A titled section of cards, one per feature or step, in a responsive grid (one column
 * on phones). `numbered` makes it an ordered list of steps. Static markup.
 */
export function FeatureGrid({
  title,
  description,
  features,
  numbered = false,
  className,
  ...props
}: FeatureGridProps) {
  const headingId = useId();
  const List = numbered ? "ol" : "ul";
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-1.5">
        <h2
          id={headingId}
          className="text-2xl font-semibold tracking-tight text-fg"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      <List
        className={cn(
          "grid gap-3.5",
          numbered
            ? "grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]"
            : "grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))]"
        )}
      >
        {features.map((feature, index) => (
          <li
            key={feature.title}
            className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised px-5 py-4 shadow-raised"
          >
            {numbered ? (
              <span className="font-mono text-xs text-fg-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
            ) : feature.icon ? (
              <span
                aria-hidden="true"
                className="inline-flex size-8 items-center justify-center rounded-lg bg-accent-subtle text-accent-text [&_svg]:size-4"
              >
                {feature.icon}
              </span>
            ) : null}
            <h3 className="text-sm font-semibold text-fg">{feature.title}</h3>
            <p className="text-sm text-fg-muted">{feature.description}</p>
          </li>
        ))}
      </List>
    </section>
  );
}
