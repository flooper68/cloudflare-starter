import type {
  HTMLAttributes,
  Ref,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";

import { cn } from "../lib/utils";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Keep the header row visible while the body scrolls. Give the container a max height. */
  readonly stickyHeader?: boolean;
  /** Classes for the scroll container around the table (e.g. `max-h-96`). */
  readonly containerClassName?: string;
  readonly ref?: Ref<HTMLTableElement>;
}

/**
 * Dense, borderless-by-default table primitives in Linear's style: hairline row
 * separators, muted header, hover rows. Compose them by hand for static data; use
 * `DataTable` for sorting, selection and pagination.
 */
export function Table({
  stickyHeader = false,
  containerClassName,
  className,
  ...props
}: TableProps) {
  return (
    <div
      className={cn("relative w-full overflow-auto", containerClassName)}
      data-sticky-header={stickyHeader || undefined}
    >
      <table
        className={cn(
          "w-full caption-bottom border-separate border-spacing-0 text-sm text-fg",
          stickyHeader &&
            "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-canvas",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("", className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("[&_tr:last-child_td]:border-b-0", className)}
      {...props}
    />
  );
}

export function TableFooter({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "bg-surface font-medium [&_td]:border-t [&_td]:border-b-0 [&_td]:border-line",
        className
      )}
      {...props}
    />
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Highlight the row (e.g. checked in a selectable table). */
  readonly selected?: boolean;
  readonly ref?: Ref<HTMLTableRowElement>;
}

export function TableRow({ selected, className, ...props }: TableRowProps) {
  return (
    <tr
      data-state={selected ? "selected" : undefined}
      aria-selected={selected}
      className={cn(
        "transition-colors duration-75 [tbody_&]:hover:bg-hover",
        "data-[state=selected]:bg-accent-subtle data-[state=selected]:hover:bg-accent-subtle",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-8 whitespace-nowrap border-b border-line px-3 text-left align-middle text-xs font-medium text-fg-muted",
        "[&:has([role=checkbox])]:w-8 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "h-9 border-b border-line px-3 align-middle",
        "[&:has([role=checkbox])]:w-8 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn("mt-3 text-xs text-fg-subtle", className)}
      {...props}
    />
  );
}
