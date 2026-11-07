import { type HTMLAttributes, useId } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

export interface DocsNavLink {
  readonly label: string;
  readonly href: string;
}

export interface DocsNavSection {
  readonly title: string;
  readonly items: readonly DocsNavLink[];
}

export interface DocsNavProps extends HTMLAttributes<HTMLElement> {
  readonly sections: readonly DocsNavSection[];
  /** The href of the page being shown; its link gets `aria-current="page"`. */
  readonly currentHref?: string;
  /** Accessible name of the navigation landmark. */
  readonly label?: string;
}

/**
 * The sidebar of a docs site: titled sections of page links, the current page
 * highlighted. Renders plain links, so it works without JavaScript (the docs pages are
 * static HTML).
 */
export function DocsNav({
  sections,
  currentHref,
  label = "Docs",
  className,
  ...props
}: DocsNavProps) {
  const id = useId();
  return (
    <nav
      aria-label={label}
      className={cn("flex flex-col gap-5", className)}
      {...props}
    >
      {sections.map((section, index) => {
        const headingId = `${id}-${index}`;
        return (
          <div key={section.title} className="flex flex-col gap-1">
            <span
              id={headingId}
              className="px-2 py-1 text-xs font-semibold text-fg"
            >
              {section.title}
            </span>
            <ul aria-labelledby={headingId} className="flex flex-col gap-px">
              {section.items.map((item) => {
                const current = item.href === currentHref;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-7 items-center rounded-md px-2 py-1 text-sm text-fg-muted transition-colors",
                        "hover:bg-hover hover:text-fg",
                        current && "bg-active text-fg",
                        focusRing
                      )}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
