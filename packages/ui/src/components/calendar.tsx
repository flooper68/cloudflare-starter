import { format } from "date-fns";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import {
  type ChevronProps,
  DayButton,
  type DayButtonProps,
  DayPicker,
  type DayPickerProps,
} from "react-day-picker";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

export type CalendarProps = DayPickerProps;

/**
 * "28 September 2026, Monday, selected": the visible day number comes first, so the
 * name of the day (a button, or a plain grid cell when the calendar is read-only)
 * contains its text (WCAG 2.5.3, label in name).
 */
function labelDay(
  date: Date,
  modifiers?: { readonly today?: boolean; readonly selected?: boolean }
): string {
  let label = format(date, "d MMMM yyyy, EEEE");
  if (modifiers?.today) label += ", today";
  if (modifiers?.selected) label += ", selected";
  return label;
}

const chevrons = {
  left: ChevronLeft,
  right: ChevronRight,
  up: ChevronUp,
  down: ChevronDown,
} as const;

function CalendarChevron({ orientation = "left", className }: ChevronProps) {
  const Icon = chevrons[orientation];
  return <Icon aria-hidden className={cn("size-4", className)} />;
}

/** Day button: accent fill when selected, a ring on today, dimmed outside the month. */
function CalendarDayButton({ modifiers, className, ...props }: DayButtonProps) {
  const rangeEnd = modifiers.range_start || modifiers.range_end;
  return (
    <DayButton
      modifiers={modifiers}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-fg text-sm tabular-nums",
        "transition-colors duration-100 hover:bg-hover",
        focusRing,
        modifiers.outside && "text-fg-subtle",
        modifiers.today && "font-semibold ring-1 ring-accent ring-inset",
        modifiers.selected &&
          "bg-accent text-accent-fg ring-0 hover:bg-accent-hover",
        modifiers.range_middle &&
          "rounded-none bg-transparent text-fg hover:bg-hover",
        rangeEnd && "bg-accent text-accent-fg hover:bg-accent-hover",
        modifiers.disabled &&
          "pointer-events-none text-fg-subtle line-through opacity-50",
        className
      )}
      {...props}
    />
  );
}

/**
 * A compact month grid (react-day-picker) in Linear's style: accent fill on the selected
 * day, a ring on today, arrow-key navigation. Accepts every DayPicker prop:
 * `mode="single" | "range" | "multiple"`, `disabled`, `numberOfMonths`, `weekStartsOn`…
 */
export function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  labels,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("relative w-fit p-3 text-fg text-sm", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-2",
        nav: "pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between",
        button_previous: cn(
          "pointer-events-auto inline-flex size-7 items-center justify-center rounded-md text-fg-muted",
          "hover:bg-hover hover:text-fg aria-disabled:pointer-events-none aria-disabled:opacity-40",
          focusRing
        ),
        button_next: cn(
          "pointer-events-auto inline-flex size-7 items-center justify-center rounded-md text-fg-muted",
          "hover:bg-hover hover:text-fg aria-disabled:pointer-events-none aria-disabled:opacity-40",
          focusRing
        ),
        month_caption: "flex h-7 items-center justify-center",
        caption_label: "font-medium text-fg text-sm",
        dropdowns: "flex items-center gap-1",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday:
          "flex h-7 w-8 items-center justify-center font-medium text-2xs text-fg-subtle",
        week: "mt-0.5 flex",
        day: "relative size-8 p-0 text-center",
        range_start: "rounded-l-md bg-accent-subtle",
        range_middle: "bg-accent-subtle",
        range_end: "rounded-r-md bg-accent-subtle",
        hidden: "invisible",
        week_number:
          "flex size-8 items-center justify-center text-2xs text-fg-subtle",
        footer: "pt-2 text-fg-muted text-xs",
        ...classNames,
      }}
      labels={{ labelDayButton: labelDay, labelGridcell: labelDay, ...labels }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}
