import {
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
} from "react";

import { cn } from "../lib/utils";

const ITEM_SELECTOR = '[role="option"]:not([aria-disabled="true"])';

function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End", "j", "k"];
  if (!keys.includes(event.key)) return;
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR)
  );
  if (items.length === 0) return;
  event.preventDefault();

  const index = items.indexOf(document.activeElement as HTMLElement);
  let next = index;
  if (event.key === "ArrowDown" || event.key === "j")
    next = Math.min(index + 1, items.length - 1);
  if (event.key === "ArrowUp" || event.key === "k")
    next = index === -1 ? 0 : Math.max(index - 1, 0);
  if (event.key === "Home") next = 0;
  if (event.key === "End") next = items.length - 1;

  for (const [i, item] of items.entries()) item.tabIndex = i === next ? 0 : -1;
  items[next]?.focus();
}

export interface ListProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name of the list, e.g. "Active issues". */
  readonly label?: string;
  readonly ref?: Ref<HTMLDivElement>;
}

/**
 * A keyboard-navigable list of rows, like Linear's issue list. Arrow keys (and j/k)
 * move between rows, Home/End jump, Enter or Space activates the focused row.
 * Group rows under `ListHeader`s.
 */
export function List({
  label,
  className,
  onKeyDown,
  ref,
  ...props
}: ListProps) {
  const localRef = useRef<HTMLDivElement | null>(null);

  // Keep exactly one row in the Tab order: the focused one, else the selected, else the first.
  useEffect(() => {
    const items = Array.from(
      localRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []
    );
    if (items.length === 0 || items.some((item) => item.tabIndex === 0)) return;
    const stop =
      items.find((item) => item.getAttribute("aria-selected") === "true") ??
      items[0];
    stop.tabIndex = 0;
  });

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        if (typeof ref === "function") return ref(node);
        if (ref) ref.current = node;
      }}
      role="listbox"
      aria-label={label}
      onKeyDown={(event) => {
        moveFocus(event);
        onKeyDown?.(event);
      }}
      className={cn("flex flex-col outline-none", className)}
      {...props}
    />
  );
}

export interface ListHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Icon before the title (e.g. a StatusIcon for a status group). */
  readonly icon?: ReactNode;
  /** Number of rows in the group. */
  readonly count?: number;
}

/**
 * A group heading inside a List: "In Progress 3". It holds no buttons: a listbox may only
 * contain options. Rows or headers with their own controls belong in a grid (see IssueList).
 */
export function ListHeader({
  icon,
  count,
  className,
  children,
  ...props
}: ListHeaderProps) {
  return (
    <div
      role="presentation"
      className={cn(
        "flex h-9 items-center gap-2 bg-surface px-4 text-sm font-medium text-fg",
        className
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
      {count !== undefined ? (
        <span className="text-fg-subtle tabular-nums">{count}</span>
      ) : null}
    </div>
  );
}

export interface ListItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "onSelect"> {
  /** Icons or ids before the title (priority, key, status). */
  readonly leading?: ReactNode;
  readonly title: ReactNode;
  /** Muted text after the title on the same line. */
  readonly description?: ReactNode;
  /** Metadata at the right: labels, assignee, date. */
  readonly trailing?: ReactNode;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  /** Called on click, Enter or Space. */
  readonly onSelect?: (event: MouseEvent | KeyboardEvent) => void;
  readonly ref?: Ref<HTMLDivElement>;
}

/** One row of a List: leading icons, title, optional description and trailing metadata. */
export function ListItem({
  leading,
  title,
  description,
  trailing,
  selected = false,
  disabled = false,
  onSelect,
  className,
  tabIndex,
  ...props
}: ListItemProps) {
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      tabIndex={tabIndex ?? -1}
      data-selected={selected || undefined}
      onClick={(event) => {
        if (!disabled) onSelect?.(event);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.(event);
        }
      }}
      onFocus={(event) => {
        // Roving tab stop: the focused row is the one Tab returns to.
        const list = event.currentTarget.closest('[role="listbox"]');
        for (const item of list?.querySelectorAll<HTMLElement>(
          '[role="option"]'
        ) ?? []) {
          item.tabIndex = item === event.currentTarget ? 0 : -1;
        }
      }}
      className={cn(
        "group/list-item flex h-11 min-w-0 cursor-default select-none items-center gap-3 border-b border-line px-4 text-sm outline-none",
        "transition-colors duration-75 hover:bg-hover focus-visible:bg-hover",
        "focus-visible:shadow-[inset_2px_0_0_var(--color-accent)]",
        "data-[selected]:bg-accent-subtle",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "[&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {leading ? (
        <div className="flex shrink-0 items-center gap-2 text-fg-muted">
          {leading}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-fg">{title}</span>
        {description ? (
          <span className="truncate text-fg-subtle">{description}</span>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2 text-xs text-fg-muted">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
