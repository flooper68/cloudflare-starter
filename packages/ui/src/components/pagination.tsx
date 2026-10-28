import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { type HTMLAttributes, useId } from "react";

import { controlBase, controlSize } from "../lib/styles";
import { cn } from "../lib/utils";
import { Button, IconButton } from "./button";

/**
 * Page numbers to show around the current page, with "ellipsis" gaps.
 * `getPaginationRange(6, 20)` → `[1, "ellipsis", 5, 6, 7, "ellipsis", 20]`.
 */
export function getPaginationRange(
  page: number,
  pageCount: number,
  siblingCount = 1
): Array<number | "ellipsis"> {
  // first + last + current + siblings + two gaps
  const slots = siblingCount * 2 + 5;
  if (pageCount <= slots) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const left = Math.max(page - siblingCount, 1);
  const right = Math.min(page + siblingCount, pageCount);
  const showLeftGap = left > 3;
  const showRightGap = right < pageCount - 2;
  const edge = siblingCount * 2 + 3;

  if (!showLeftGap) {
    return [
      ...Array.from({ length: edge }, (_, index) => index + 1),
      "ellipsis",
      pageCount,
    ];
  }
  if (!showRightGap) {
    return [
      1,
      "ellipsis",
      ...Array.from(
        { length: edge },
        (_, index) => pageCount - edge + 1 + index
      ),
    ];
  }
  return [
    1,
    "ellipsis",
    ...Array.from({ length: right - left + 1 }, (_, index) => left + index),
    "ellipsis",
    pageCount,
  ];
}

export interface PaginationProps
  extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  /** Current page, 1-based. */
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
  /** Total number of items; shows "1–20 of 312". */
  readonly total?: number;
  readonly pageSize?: number;
  /** Shows a page size select when given together with `onPageSizeChange`. */
  readonly pageSizeOptions?: readonly number[];
  readonly onPageSizeChange?: (pageSize: number) => void;
  /** Pages shown on each side of the current one. */
  readonly siblingCount?: number;
  /** Hide the numbered buttons (only prev/next), for narrow footers. */
  readonly compact?: boolean;
}

/**
 * Page navigation for long lists and tables: range summary, page size, numbered pages
 * with gaps and previous/next. Pages are 1-based.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  siblingCount = 1,
  compact = false,
  className,
  ...props
}: PaginationProps) {
  const selectId = useId();
  const pages = Math.max(pageCount, 1);
  const current = Math.min(Math.max(page, 1), pages);
  const range = getPaginationRange(current, pages, siblingCount);
  const format = (value: number) => value.toLocaleString("en-US");

  let summary: string | null = null;
  if (total !== undefined && pageSize !== undefined) {
    const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
    const to = Math.min(current * pageSize, total);
    summary = `${format(from)}–${format(to)} of ${format(total)}`;
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 text-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 text-fg-muted">
        {pageSizeOptions && onPageSizeChange && pageSize !== undefined ? (
          <div className="flex items-center gap-2">
            <label htmlFor={selectId} className="text-xs">
              Rows per page
            </label>
            <div className="relative">
              <select
                id={selectId}
                value={pageSize}
                onChange={(event) =>
                  onPageSizeChange(Number(event.target.value))
                }
                className={cn(
                  controlBase,
                  controlSize.sm,
                  "w-auto cursor-pointer appearance-none pr-7 tabular-nums"
                )}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-fg-subtle"
              />
            </div>
          </div>
        ) : null}
        {summary ? (
          <span className="text-xs tabular-nums" aria-live="polite">
            {summary}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <IconButton
          label="Previous page"
          size="sm"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft />
        </IconButton>
        {compact ? (
          <span className="px-2 text-xs tabular-nums text-fg-muted">
            Page {current} of {pages}
          </span>
        ) : (
          range.map((item, index) =>
            item === "ellipsis" ? (
              <span
                // Gaps have no identity; position is stable for a given range.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                key={`gap-${index}`}
                aria-hidden
                className="inline-flex size-7 items-center justify-center text-fg-subtle"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                size="sm"
                variant={item === current ? "secondary" : "ghost"}
                aria-label={`Page ${item}`}
                aria-current={item === current ? "page" : undefined}
                onClick={() => onPageChange(item)}
                className={cn(
                  "min-w-7 px-1.5 tabular-nums",
                  item === current && "text-fg"
                )}
              >
                {item}
              </Button>
            )
          )
        )}
        <IconButton
          label="Next page"
          size="sm"
          disabled={current >= pages}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight />
        </IconButton>
      </div>
    </nav>
  );
}
