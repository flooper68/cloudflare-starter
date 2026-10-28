import { Command } from "cmdk";
import { ChevronDown, X } from "lucide-react";
import { useControllableState } from "radix-ui/internal";
import type { KeyboardEvent, ReactNode } from "react";
import { useState } from "react";

import { controlBase, controlSize, focusRing, menuItem } from "../lib/styles";
import { cn } from "../lib/utils";
import {
  AsyncOptionsStatus,
  type OptionLoader,
  useAsyncOptions,
} from "./async-select";
import {
  ComboboxInput,
  ComboboxMessage,
  type ComboboxOption,
  ComboboxOptions,
  comboboxList,
  type FieldControlProps,
  openOnArrowKeys,
} from "./combobox";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { Spinner } from "./spinner";

/** A small removable token, used for selected values and tags. */
export function Chip({
  children,
  icon,
  onRemove,
  removeLabel,
  disabled,
  className,
}: {
  readonly children: ReactNode;
  readonly icon?: ReactNode;
  /** Shows an × button. */
  readonly onRemove?: () => void;
  /** Accessible name of the × button, e.g. "Remove Bug". */
  readonly removeLabel?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-0 max-w-40 shrink-0 items-center gap-1 rounded-sm border border-line bg-active pl-1.5 text-fg text-xs",
        onRemove ? "pr-0.5" : "pr-1.5",
        "[&>svg]:size-3 [&>svg]:shrink-0 [&>svg]:text-fg-muted",
        className
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          title={removeLabel}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg",
            focusRing
          )}
        >
          <X aria-hidden className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

interface ShellProps extends FieldControlProps {
  readonly selected: readonly ComboboxOption[];
  readonly onRemove: (option: ComboboxOption) => void;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly placeholder: ReactNode;
  readonly size: keyof typeof controlSize;
  readonly disabled?: boolean;
  readonly maxVisible: number;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly children: ReactNode;
}

/** The chip trigger and the panel; shared by MultiSelect and AsyncMultiSelect. */
function MultiSelectShell({
  selected,
  onRemove,
  open,
  onOpenChange,
  placeholder,
  size,
  disabled,
  maxVisible,
  className,
  contentClassName,
  children,
  ...fieldProps
}: ShellProps) {
  const visible = selected.slice(0, maxVisible);
  const hidden = selected.slice(maxVisible);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div
          aria-invalid={fieldProps["aria-invalid"]}
          aria-disabled={disabled || undefined}
          className={cn(
            controlBase,
            controlSize[size],
            "flex items-center gap-1 overflow-hidden pr-2",
            visible.length > 0 && "pl-1",
            "has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
            "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
            className
          )}
        >
          {visible.map((option) => (
            <Chip
              key={option.value}
              icon={option.icon}
              disabled={disabled}
              removeLabel={`Remove ${option.label}`}
              onRemove={() => onRemove(option)}
            >
              {option.label}
            </Chip>
          ))}
          {hidden.length > 0 ? (
            <span title={hidden.map((option) => option.label).join(", ")}>
              <Chip>+{hidden.length}</Chip>
            </span>
          ) : null}
          <PopoverTrigger asChild>
            <button
              {...fieldProps}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              disabled={disabled}
              onKeyDown={openOnArrowKeys(onOpenChange)}
              className="flex min-w-6 flex-1 items-center gap-2 self-stretch text-left outline-none disabled:cursor-not-allowed"
            >
              <span className="min-w-0 flex-1 truncate text-fg-subtle">
                {selected.length === 0 ? placeholder : null}
              </span>
              <ChevronDown
                aria-hidden
                className="size-4 shrink-0 text-fg-muted"
              />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className={cn(
          "w-(--radix-popover-trigger-width) min-w-60 p-0",
          contentClassName
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function ClearSelection({ onClear }: { readonly onClear: () => void }) {
  return (
    <>
      <Command.Separator className="-mx-1 my-1 h-px bg-line" alwaysRender />
      <Command.Item
        forceMount
        value="__clear__"
        onSelect={onClear}
        className={menuItem}
      >
        <X aria-hidden />
        Clear selection
      </Command.Item>
    </>
  );
}

/** Backspace in an empty search removes the last selected value. */
function removeLastOnBackspace(
  search: string,
  selected: readonly ComboboxOption[],
  remove: (option: ComboboxOption) => void
) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    const last = selected.at(-1);
    if (event.key === "Backspace" && search === "" && last) remove(last);
  };
}

interface MultiSelectBaseProps extends FieldControlProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly placeholder?: ReactNode;
  readonly searchPlaceholder?: string;
  readonly emptyText?: ReactNode;
  readonly size?: keyof typeof controlSize;
  readonly disabled?: boolean;
  /** Chips shown in the trigger before the rest collapse into "+N". */
  readonly maxVisible?: number;
  readonly className?: string;
  readonly contentClassName?: string;
}

export interface MultiSelectProps extends MultiSelectBaseProps {
  readonly options: readonly ComboboxOption[];
  /** Selected option values, in the order they were picked. */
  readonly value?: readonly string[];
  readonly defaultValue?: readonly string[];
  readonly onValueChange?: (value: readonly string[]) => void;
}

/**
 * Pick several options from a searchable list. Selected values show as removable chips in
 * the trigger (the rest collapse into "+N"); the panel stays open while toggling. Backspace
 * in the empty search removes the last value.
 */
export function MultiSelect({
  options,
  value: valueProp,
  defaultValue = [],
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  size = "md",
  maxVisible = 3,
  ...props
}: MultiSelectProps) {
  const [value, setValue] = useControllableState<readonly string[]>({
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
  const selected = value.flatMap((item) => {
    const option = options.find((candidate) => candidate.value === item);
    return option ? [option] : [];
  });

  function toggle(option: ComboboxOption) {
    setValue(
      value.includes(option.value)
        ? value.filter((item) => item !== option.value)
        : [...value, option.value]
    );
  }

  return (
    <MultiSelectShell
      {...props}
      selected={selected}
      onRemove={toggle}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      placeholder={placeholder}
      size={size}
      maxVisible={maxVisible}
    >
      <Command loop>
        <ComboboxInput
          value={search}
          onValueChange={setSearch}
          placeholder={searchPlaceholder}
          onKeyDown={removeLastOnBackspace(search, selected, toggle)}
        />
        <Command.List className={comboboxList}>
          <Command.Empty>
            <ComboboxMessage>{emptyText}</ComboboxMessage>
          </Command.Empty>
          <ComboboxOptions
            options={options}
            indicator="checkbox"
            isSelected={(option) => value.includes(option.value)}
            onSelect={toggle}
          />
          {value.length > 0 && search === "" ? (
            <ClearSelection onClear={() => setValue([])} />
          ) : null}
        </Command.List>
      </Command>
    </MultiSelectShell>
  );
}

export interface AsyncMultiSelectProps extends MultiSelectBaseProps {
  /** `(query, signal) => Promise<ComboboxOption[]>`; called debounced while open. */
  readonly loader: OptionLoader;
  /** Selected options (whole options, since the list is loaded on demand). */
  readonly value?: readonly ComboboxOption[];
  readonly defaultValue?: readonly ComboboxOption[];
  readonly onValueChange?: (value: readonly ComboboxOption[]) => void;
  readonly errorText?: ReactNode;
  readonly minQueryLength?: number;
  readonly debounceMs?: number;
}

/** MultiSelect with options from a loader (same contract and states as AsyncSelect). */
export function AsyncMultiSelect({
  loader,
  value: valueProp,
  defaultValue = [],
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  errorText = "Couldn't load results",
  minQueryLength = 0,
  debounceMs,
  size = "md",
  maxVisible = 3,
  ...props
}: AsyncMultiSelectProps) {
  const [value, setValue] = useControllableState<readonly ComboboxOption[]>({
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
  const state = useAsyncOptions({
    loader,
    query: search,
    enabled: open,
    debounceMs,
    minQueryLength,
  });

  function toggle(option: ComboboxOption) {
    setValue(
      value.some((item) => item.value === option.value)
        ? value.filter((item) => item.value !== option.value)
        : [...value, option]
    );
  }

  return (
    <MultiSelectShell
      {...props}
      selected={value}
      onRemove={toggle}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      placeholder={placeholder}
      size={size}
      maxVisible={maxVisible}
    >
      <Command shouldFilter={false} loop>
        <ComboboxInput
          value={search}
          onValueChange={setSearch}
          placeholder={searchPlaceholder}
          onKeyDown={removeLastOnBackspace(search, value, toggle)}
          trailing={
            state.status === "loading" ? <Spinner label="Loading" /> : null
          }
        />
        <Command.List
          className={comboboxList}
          aria-busy={state.status === "loading"}
        >
          <AsyncOptionsStatus
            state={state}
            minQueryLength={minQueryLength}
            emptyText={emptyText}
            errorText={errorText}
          />
          <ComboboxOptions
            options={state.options}
            indicator="checkbox"
            isSelected={(option) =>
              value.some((item) => item.value === option.value)
            }
            onSelect={toggle}
          />
          {value.length > 0 && search === "" ? (
            <ClearSelection onClear={() => setValue([])} />
          ) : null}
        </Command.List>
      </Command>
    </MultiSelectShell>
  );
}
