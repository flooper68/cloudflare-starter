import { Command } from "cmdk";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { useControllableState } from "radix-ui/internal";
import type {
  ButtonHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import { useState } from "react";

import { controlBase, controlSize, menuItem, menuLabel } from "../lib/styles";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** One choice in a Combobox, AsyncSelect or MultiSelect. */
export interface ComboboxOption {
  /** Stable id; what `onValueChange` receives. */
  readonly value: string;
  /** Visible text; also what the search matches. */
  readonly label: string;
  /** Icon or avatar before the label. */
  readonly icon?: ReactNode;
  /** Secondary text after the label (an email, a count, a shortcut). */
  readonly description?: ReactNode;
  /** Extra search terms (e.g. the identifier of a team). */
  readonly keywords?: readonly string[];
  /** Heading the option is listed under. Keep options of one group adjacent. */
  readonly group?: string;
  readonly disabled?: boolean;
}

/** Props a `<Field>` wires onto its control; composite controls put them on their trigger. */
export interface FieldControlProps {
  readonly id?: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: boolean | "true" | "false";
  readonly "aria-label"?: string;
  readonly "aria-labelledby"?: string;
}

/** Splits options into runs that share a `group`, keeping their order. */
export function groupOptions(options: readonly ComboboxOption[]) {
  const groups: { heading: string | undefined; options: ComboboxOption[] }[] =
    [];
  for (const option of options) {
    const last = groups.at(-1);
    if (last && last.heading === option.group) last.options.push(option);
    else groups.push({ heading: option.group, options: [option] });
  }
  return groups;
}

/** Opens a closed picker with ArrowDown / ArrowUp, like a native select. */
export function openOnArrowKeys(open: (next: boolean) => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      open(true);
    }
  };
}

export interface PickerTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly size?: keyof typeof controlSize;
  /** Icon before the value (e.g. the selected option's icon). */
  readonly icon?: ReactNode;
  /** Shown, dimmed, when there are no children. */
  readonly placeholder?: ReactNode;
  readonly ref?: Ref<HTMLButtonElement>;
}

/**
 * The closed state of Combobox, AsyncSelect and DatePicker: looks like an input and opens a
 * panel. Children are the current value; without them the placeholder shows.
 */
export function PickerTrigger({
  size = "md",
  icon,
  placeholder,
  className,
  children,
  type = "button",
  ...props
}: PickerTriggerProps) {
  const empty = children == null || children === false || children === "";
  return (
    <button
      type={type}
      data-placeholder={empty ? "" : undefined}
      className={cn(
        controlBase,
        controlSize[size],
        "flex items-center gap-2 text-left",
        // Icons inherit muted text but keep their own colour class (status icons).
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {icon ? (
        <span className="flex shrink-0 text-fg-muted">{icon}</span>
      ) : null}
      <span
        className={cn("min-w-0 flex-1 truncate", empty && "text-fg-subtle")}
      >
        {empty ? placeholder : children}
      </span>
      <ChevronDown aria-hidden className="text-fg-muted" />
    </button>
  );
}

/** Classes of the scrolling list inside a combobox panel. */
export const comboboxList =
  "max-h-72 scroll-py-1 overflow-y-auto overscroll-contain p-1";

/** The search row at the top of a combobox panel. */
export function ComboboxInput({
  value,
  onValueChange,
  placeholder,
  trailing,
  onKeyDown,
}: {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string;
  /** Spinner or hint at the end of the row. */
  readonly trailing?: ReactNode;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex items-center gap-2 border-line border-b px-3">
      <Search aria-hidden className="size-4 shrink-0 text-fg-subtle" />
      <Command.Input
        value={value}
        onValueChange={onValueChange}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className="h-9 w-full min-w-0 bg-transparent text-fg text-sm outline-none placeholder:text-fg-subtle"
      />
      {trailing ? (
        <span className="flex shrink-0 text-fg-subtle">{trailing}</span>
      ) : null}
    </div>
  );
}

/** A checkbox-like mark for multi-select rows. */
export function CheckMark({ checked }: { readonly checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-line-strong transition-colors",
        checked && "border-accent bg-accent"
      )}
    >
      {checked ? (
        <Check strokeWidth={3} className="size-2.5! text-accent-fg!" />
      ) : null}
    </span>
  );
}

/** One option row in a cmdk list. */
export function ComboboxItem({
  option,
  selected,
  indicator = "check",
  onSelect,
}: {
  readonly option: ComboboxOption;
  readonly selected: boolean;
  /** `check` for single select (mark at the end), `checkbox` for multi select. */
  readonly indicator?: "check" | "checkbox";
  readonly onSelect: () => void;
}) {
  return (
    <Command.Item
      value={option.value}
      keywords={[option.label, ...(option.keywords ?? [])]}
      disabled={option.disabled}
      onSelect={onSelect}
      className={menuItem}
    >
      {indicator === "checkbox" ? <CheckMark checked={selected} /> : null}
      {option.icon}
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      {option.description ? (
        <span className="shrink-0 text-fg-subtle text-xs">
          {option.description}
        </span>
      ) : null}
      {indicator === "check" ? (
        <Check
          aria-hidden
          className={cn("text-fg!", !selected && "invisible")}
        />
      ) : null}
    </Command.Item>
  );
}

/** Options grouped under headings, as cmdk groups. */
export function ComboboxOptions({
  options,
  isSelected,
  onSelect,
  indicator,
}: {
  readonly options: readonly ComboboxOption[];
  readonly isSelected: (option: ComboboxOption) => boolean;
  readonly onSelect: (option: ComboboxOption) => void;
  readonly indicator?: "check" | "checkbox";
}) {
  return groupOptions(options).map((group, index) => (
    <Command.Group
      // Groups have no id of their own; heading plus position is stable enough.
      // biome-ignore lint/suspicious/noArrayIndexKey: two runs may share a heading.
      key={`${group.heading ?? ""}-${index}`}
      heading={
        group.heading ? <div className={menuLabel}>{group.heading}</div> : null
      }
    >
      {group.options.map((option) => (
        <ComboboxItem
          key={option.value}
          option={option}
          indicator={indicator}
          selected={isSelected(option)}
          onSelect={() => onSelect(option)}
        />
      ))}
    </Command.Group>
  ));
}

/** Centered message inside a combobox list (empty, loading, error). */
export function ComboboxMessage({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-2 py-6 text-center text-fg-subtle text-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface ComboboxProps extends FieldControlProps {
  readonly options: readonly ComboboxOption[];
  readonly value?: string | null;
  readonly defaultValue?: string | null;
  readonly onValueChange?: (value: string | null) => void;
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly placeholder?: ReactNode;
  readonly searchPlaceholder?: string;
  /** Shown when the search matches nothing. */
  readonly emptyText?: ReactNode;
  readonly size?: keyof typeof controlSize;
  readonly disabled?: boolean;
  /** Choosing the selected option again clears the value. */
  readonly deselectable?: boolean;
  /** Adds a "Create …" row for a search that matches no option label exactly. */
  readonly onCreate?: (query: string) => void;
  /** Text of the create row; defaults to `Create "query"`. */
  readonly createLabel?: (query: string) => ReactNode;
  readonly className?: string;
  readonly contentClassName?: string;
}

/**
 * Searchable single select: a trigger that opens a filterable list (cmdk in a Popover).
 * Arrow keys move, Enter picks, Escape closes; ArrowDown on the trigger opens it. Pass
 * `onCreate` to offer a "Create …" row when nothing matches, like adding a new label.
 */
export function Combobox({
  options,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  size = "md",
  disabled,
  deselectable = false,
  onCreate,
  createLabel,
  className,
  contentClassName,
  ...fieldProps
}: ComboboxProps) {
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  const query = search.trim();
  const canCreate =
    onCreate !== undefined &&
    query !== "" &&
    !options.some(
      (option) => option.label.toLowerCase() === query.toLowerCase()
    );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setSearch("");
  }

  function select(option: ComboboxOption) {
    setValue(deselectable && option.value === value ? null : option.value);
    handleOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <PickerTrigger
          {...fieldProps}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          size={size}
          disabled={disabled}
          icon={selected?.icon}
          placeholder={placeholder}
          className={className}
          onKeyDown={openOnArrowKeys(handleOpenChange)}
        >
          {selected?.label}
        </PickerTrigger>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-60 p-0",
          contentClassName
        )}
      >
        <Command loop>
          <ComboboxInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <Command.List className={comboboxList}>
            <Command.Empty>
              <ComboboxMessage>{emptyText}</ComboboxMessage>
            </Command.Empty>
            <ComboboxOptions
              options={options}
              isSelected={(option) => option.value === value}
              onSelect={select}
            />
            {canCreate ? (
              <Command.Item
                forceMount
                value={`__create__${query}`}
                onSelect={() => {
                  onCreate(query);
                  handleOpenChange(false);
                }}
                className={menuItem}
              >
                <Plus aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {createLabel ? createLabel(query) : `Create "${query}"`}
                </span>
              </Command.Item>
            ) : null}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
