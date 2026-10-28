import { ChevronRight, MoreHorizontal } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { Fragment, type HTMLAttributes, type ReactNode } from "react";

import { focusRing, menuItem, overlayContent } from "../lib/styles";
import { cn } from "../lib/utils";

export interface BreadcrumbItem {
  readonly label: string;
  readonly href?: string;
  readonly icon?: ReactNode;
  /** For client-side navigation; called instead of following `href`. */
  readonly onClick?: () => void;
}

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  /** From the root to the current page; the last item is the current page. */
  readonly items: readonly BreadcrumbItem[];
  /** Collapse middle items into a "…" menu when there are more than this. */
  readonly maxItems?: number;
  /** Separator between items. Defaults to a chevron. */
  readonly separator?: ReactNode;
}

const crumbClass = cn(
  "inline-flex h-6 min-w-0 items-center gap-1.5 rounded-sm px-1 text-fg-muted transition-colors",
  "hover:bg-hover hover:text-fg [&_svg]:size-3.5 [&_svg]:shrink-0",
  focusRing
);

function Crumb({ item }: { readonly item: BreadcrumbItem }) {
  const content = (
    <>
      {item.icon}
      <span className="truncate">{item.label}</span>
    </>
  );
  if (item.href) {
    return (
      <a
        href={item.href}
        className={crumbClass}
        onClick={
          item.onClick
            ? (event) => {
                event.preventDefault();
                item.onClick?.();
              }
            : undefined
        }
      >
        {content}
      </a>
    );
  }
  if (item.onClick) {
    return (
      <button type="button" className={crumbClass} onClick={item.onClick}>
        {content}
      </button>
    );
  }
  return (
    <span className={cn(crumbClass, "hover:bg-transparent")}>{content}</span>
  );
}

/**
 * Where the current page sits: Workspace › Project › Issue. Long trails collapse their
 * middle into a "…" menu; the last item is the current page (`aria-current="page"`).
 */
export function Breadcrumbs({
  items,
  maxItems = 4,
  separator,
  className,
  ...props
}: BreadcrumbsProps) {
  const collapse = items.length > maxItems && maxItems >= 3;
  // Keep the first item and the last (maxItems - 2) items; the rest go into the menu.
  const tailCount = Math.max(maxItems - 2, 1);
  const hidden = collapse ? items.slice(1, items.length - tailCount) : [];
  const shown: Array<BreadcrumbItem | "collapsed"> = collapse
    ? [items[0], "collapsed", ...items.slice(items.length - tailCount)]
    : [...items];

  const sep = (
    <li aria-hidden className="flex text-fg-subtle [&_svg]:size-3.5">
      {separator ?? <ChevronRight />}
    </li>
  );

  return (
    <nav aria-label="Breadcrumb" className={className} {...props}>
      <ol className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm">
        {shown.map((entry, index) => {
          const isLast = index === shown.length - 1;
          if (entry === "collapsed") {
            return (
              <Fragment key="collapsed">
                <li>
                  <DropdownMenuPrimitive.Root>
                    <DropdownMenuPrimitive.Trigger
                      aria-label={`Show ${hidden.length} more`}
                      className={cn(crumbClass, "px-1")}
                    >
                      <MoreHorizontal />
                    </DropdownMenuPrimitive.Trigger>
                    <DropdownMenuPrimitive.Portal>
                      <DropdownMenuPrimitive.Content
                        align="start"
                        sideOffset={6}
                        className={cn(overlayContent, "min-w-40 p-1")}
                      >
                        {hidden.map((item) => (
                          <DropdownMenuPrimitive.Item
                            key={`${item.label}-${item.href ?? ""}`}
                            className={menuItem}
                            asChild={Boolean(item.href)}
                            onSelect={item.onClick}
                          >
                            {item.href ? (
                              <a href={item.href}>
                                {item.icon}
                                {item.label}
                              </a>
                            ) : (
                              <>
                                {item.icon}
                                {item.label}
                              </>
                            )}
                          </DropdownMenuPrimitive.Item>
                        ))}
                      </DropdownMenuPrimitive.Content>
                    </DropdownMenuPrimitive.Portal>
                  </DropdownMenuPrimitive.Root>
                </li>
                {sep}
              </Fragment>
            );
          }
          return (
            <Fragment key={`${entry.label}-${entry.href ?? index}`}>
              <li className="flex min-w-0">
                {isLast ? (
                  <span
                    aria-current="page"
                    className="inline-flex h-6 min-w-0 items-center gap-1.5 px-1 font-medium text-fg [&_svg]:size-3.5 [&_svg]:shrink-0"
                  >
                    {entry.icon}
                    <span className="truncate">{entry.label}</span>
                  </span>
                ) : (
                  <Crumb item={entry} />
                )}
              </li>
              {isLast ? null : sep}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
