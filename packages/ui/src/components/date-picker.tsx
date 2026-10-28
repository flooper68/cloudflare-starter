import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isSameYear,
  nextMonday,
  startOfMonth,
  startOfToday,
  subDays,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import { useControllableState } from "radix-ui/internal";
import type { ReactNode } from "react";
import type { DateRange, Matcher } from "react-day-picker";

import type { controlSize } from "../lib/styles";
import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";
import { Calendar } from "./calendar";
import {
  type FieldControlProps,
  openOnArrowKeys,
  PickerTrigger,
  panelLabel,
} from "./combobox";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type { DateRange };

/** "Oct 28", or "Oct 28, 2027" outside the current year. */
export function formatShortDate(date: Date) {
  return format(date, isSameYear(date, new Date()) ? "MMM d" : "MMM d, yyyy");
}

export interface DatePreset {
  readonly label: string;
  /** Evaluated when the panel opens; `null` clears the date. */
  readonly date: () => Date | null;
}

/** Today, Tomorrow, Next week (Monday), No date — like Linear's due-date picker. */
export const defaultDatePresets: readonly DatePreset[] = [
  { label: "Today", date: () => startOfToday() },
  { label: "Tomorrow", date: () => addDays(startOfToday(), 1) },
  { label: "Next week", date: () => nextMonday(startOfToday()) },
  { label: "No date", date: () => null },
];

export interface DateRangePreset {
  readonly label: string;
  readonly range: () => DateRange;
}

export const defaultDateRangePresets: readonly DateRangePreset[] = [
  {
    label: "Last 7 days",
    range: () => ({ from: subDays(startOfToday(), 6), to: startOfToday() }),
  },
  {
    label: "Last 30 days",
    range: () => ({ from: subDays(startOfToday(), 29), to: startOfToday() }),
  },
  {
    label: "This month",
    range: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Next 2 weeks",
    range: () => ({ from: startOfToday(), to: addDays(startOfToday(), 13) }),
  },
];

const presetRow = cn(
  "flex h-8 w-full items-center justify-between gap-4 rounded-md px-2 text-left text-fg text-sm",
  "hover:bg-hover aria-pressed:bg-active",
  focusRing
);

interface PickerBaseProps extends FieldControlProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly placeholder?: ReactNode;
  readonly size?: keyof typeof controlSize;
  readonly disabled?: boolean;
  /** Days that cannot be picked, e.g. `{ before: new Date() }`. */
  readonly disabledDates?: Matcher | Matcher[];
  readonly weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly className?: string;
  readonly contentClassName?: string;
}

export interface DatePickerProps extends PickerBaseProps {
  /** `null` is "no date". */
  readonly value?: Date | null;
  readonly defaultValue?: Date | null;
  readonly onValueChange?: (date: Date | null) => void;
  /** Quick picks above the calendar; pass `[]` to hide them. */
  readonly presets?: readonly DatePreset[];
  /** Formats the value in the trigger. */
  readonly formatValue?: (date: Date) => string;
}

/**
 * A date field: a trigger showing "Oct 28" that opens quick presets (Today, Tomorrow, Next
 * week, No date) above a calendar, like setting a due date in Linear. Closes on pick.
 */
export function DatePicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Set date",
  size = "md",
  disabled,
  disabledDates,
  weekStartsOn,
  presets = defaultDatePresets,
  formatValue = formatShortDate,
  className,
  contentClassName,
  ...fieldProps
}: DatePickerProps) {
  const [value, setValue] = useControllableState<Date | null>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });

  function pick(date: Date | null) {
    setValue(date);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PickerTrigger
          {...fieldProps}
          aria-haspopup="dialog"
          size={size}
          disabled={disabled}
          icon={<CalendarDays />}
          placeholder={placeholder}
          className={className}
          onKeyDown={openOnArrowKeys(setOpen)}
        >
          {value ? formatValue(value) : null}
        </PickerTrigger>
      </PopoverTrigger>
      <PopoverContent
        aria-label={
          fieldProps["aria-labelledby"]
            ? undefined
            : panelLabel(fieldProps["aria-label"], placeholder)
        }
        aria-labelledby={fieldProps["aria-labelledby"]}
        className={cn("w-auto p-0", contentClassName)}
      >
        {presets.length > 0 ? (
          <div className="flex flex-col border-line border-b p-1">
            {presets.map((preset) => {
              const date = preset.date();
              const active = date
                ? value !== null && isSameDay(date, value)
                : value === null;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pick(date)}
                  className={presetRow}
                >
                  {preset.label}
                  <span className="text-fg-subtle text-xs">
                    {date ? format(date, "EEE, MMM d") : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        <Calendar
          mode="single"
          selected={value ?? undefined}
          defaultMonth={value ?? undefined}
          onSelect={(date) => pick(date ?? null)}
          disabled={disabledDates}
          weekStartsOn={weekStartsOn}
          autoFocus={presets.length === 0}
        />
      </PopoverContent>
    </Popover>
  );
}

export interface DateRangePickerProps extends PickerBaseProps {
  readonly value?: DateRange | null;
  readonly defaultValue?: DateRange | null;
  readonly onValueChange?: (range: DateRange | null) => void;
  /** Quick ranges beside the calendar; pass `[]` to hide them. */
  readonly presets?: readonly DateRangePreset[];
  /** Months shown side by side (default 2). */
  readonly numberOfMonths?: number;
}

function formatRange(range: DateRange) {
  if (!range.from) return null;
  if (!range.to || isSameDay(range.from, range.to))
    return formatShortDate(range.from);
  return `${formatShortDate(range.from)} – ${formatShortDate(range.to)}`;
}

/**
 * Pick a start and end date (e.g. a cycle or a report period) on two months, with quick
 * ranges (Last 7 days, This month…) on the side. Stays open until dismissed.
 */
export function DateRangePicker({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Pick a date range",
  size = "md",
  disabled,
  disabledDates,
  weekStartsOn,
  presets = defaultDateRangePresets,
  numberOfMonths = 2,
  className,
  contentClassName,
  ...fieldProps
}: DateRangePickerProps) {
  const [value, setValue] = useControllableState<DateRange | null>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <PickerTrigger
          {...fieldProps}
          aria-haspopup="dialog"
          size={size}
          disabled={disabled}
          icon={<CalendarDays />}
          placeholder={placeholder}
          className={className}
          onKeyDown={openOnArrowKeys(setOpen)}
        >
          {value ? formatRange(value) : null}
        </PickerTrigger>
      </PopoverTrigger>
      <PopoverContent
        aria-label={
          fieldProps["aria-labelledby"]
            ? undefined
            : panelLabel(fieldProps["aria-label"], placeholder)
        }
        aria-labelledby={fieldProps["aria-labelledby"]}
        className={cn("flex w-auto p-0", contentClassName)}
      >
        {presets.length > 0 ? (
          <div className="flex w-36 shrink-0 flex-col gap-px border-line border-r p-1">
            {presets.map((preset) => {
              const range = preset.range();
              const active =
                !!value?.from &&
                !!value.to &&
                !!range.from &&
                !!range.to &&
                isSameDay(value.from, range.from) &&
                isSameDay(value.to, range.to);
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setValue(range);
                    setOpen(false);
                  }}
                  className={presetRow}
                >
                  {preset.label}
                </button>
              );
            })}
            {value ? (
              <button
                type="button"
                onClick={() => setValue(null)}
                className={cn(presetRow, "mt-auto text-fg-muted")}
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
        <Calendar
          mode="range"
          selected={value ?? undefined}
          defaultMonth={value?.from}
          onSelect={(range) => setValue(range?.from ? range : null)}
          numberOfMonths={numberOfMonths}
          disabled={disabledDates}
          weekStartsOn={weekStartsOn}
        />
      </PopoverContent>
    </Popover>
  );
}
