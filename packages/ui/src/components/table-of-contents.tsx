import type { HTMLAttributes } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

export interface TocHeading {
  /** 2 or 3; deeper headings are left out. */
  readonly depth: number;
  /** The heading's id, the link's fragment. */
  readonly slug: string;
  readonly text: string;
}

export interface TableOfContentsProps extends HTMLAttributes<HTMLElement> {
  readonly headings: readonly TocHeading[];
  /** Heading of the list, also the landmark's name. */
  readonly title?: string;
}

/**
 * "On this page": links to the second- and third-level headings of a long page, the
 * third level indented. Renders nothing when the page has no such headings.
 */
export function TableOfContents({
  headings,
  title = "On this page",
  className,
  ...props
}: TableOfContentsProps) {
  const items = headings.filter(
    (heading) => heading.depth === 2 || heading.depth === 3
  );
  if (items.length === 0) return null;
  return (
    <nav
      aria-label={title}
      className={cn("flex flex-col gap-2 text-xs", className)}
      {...props}
    >
      <span className="font-semibold text-fg">{title}</span>
      <ul className="flex flex-col gap-1.5">
        {items.map((heading) => (
          <li key={heading.slug} className={heading.depth === 3 ? "pl-3" : ""}>
            <a
              href={`#${heading.slug}`}
              className={cn(
                "rounded-sm text-fg-muted transition-colors hover:text-fg",
                focusRing
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
