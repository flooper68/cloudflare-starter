import { Command } from "cmdk";
import { Check, ChevronLeft, ListFilter, X } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { type KeyboardEvent, type ReactNode, useState } from "react";

import { focusRing, menuItem, overlayContent } from "../../lib/styles";
import { cn } from "../../lib/utils";
import { Button } from "../button";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { commandInput, commandItem, useControllable } from "./internal";

export interface FilterOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: ReactNode;
}

export interface FilterProperty {
  readonly id: string;
  readonly label: string;
  /** Plural used when many values are picked: "3 statuses". Defaults to label + "s". */
  readonly pluralLabel?: string;
  readonly icon?: ReactNode;
  readonly options: readonly FilterOption[];
}

export type FilterOperator = "is" | "is_not";

export interface Filter {
  readonly id: string;
  /** FilterProperty id. */
  readonly property: string;
  readonly operator: FilterOperator;
  readonly values: readonly string[];
}

const operatorLabel: Record<FilterOperator, (many: boolean) => string> = {
  is: (many) => (many ? "is any of" : "is"),
  is_not: (many) => (many ? "is not any of" : "is not"),
};

let filterSeq = 0;
const newFilterId = () => {
  filterSeq += 1;
  return `filter-${Date.now().toString(36)}-${filterSeq}`;
};

/** Adds or removes a value of a property, creating or dropping its filter as needed. */
function toggleValue(
  filters: readonly Filter[],
  property: string,
  value: string
): Filter[] {
  const existing = filters.find((f) => f.property === property);
  if (!existing) {
    return [
      ...filters,
      { id: newFilterId(), property, operator: "is", values: [value] },
    ];
  }
  const values = existing.values.includes(value)
    ? existing.values.filter((v) => v !== value)
    : [...existing.values, value];
  if (values.length === 0) return filters.filter((f) => f !== existing);
  return filters.map((f) => (f === existing ? { ...f, values } : f));
}

/** Matches an item against filters; `get` reads a property's value(s) from the item. */
export function matchesFilters<T>(
  item: T,
  filters: readonly Filter[],
  get: (
    item: T,
    property: string
  ) => string | readonly string[] | null | undefined
): boolean {
  return filters.every((filter) => {
    if (filter.values.length === 0) return true;
    const raw = get(item, filter.property);
    const values = raw == null ? [] : typeof raw === "string" ? [raw] : raw;
    const hit = values.some((v) => filter.values.includes(v));
    return filter.operator === "is" ? hit : !hit;
  });
}

function ValueList({
  property,
  selected,
  onToggle,
  search,
  onSearchChange,
  onBack,
}: {
  readonly property: FilterProperty;
  readonly selected: readonly string[];
  readonly onToggle: (value: string) => void;
  readonly search: string;
  readonly onSearchChange: (search: string) => void;
  readonly onBack?: () => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (onBack && event.key === "Backspace" && search === "") {
      event.preventDefault();
      onBack();
    }
  };
  return (
    <Command loop onKeyDown={onKeyDown}>
      <div className="flex items-center border-b border-line">
        {onBack ? (
          <button
            type="button"
            aria-label="Back to properties"
            onClick={onBack}
            className={cn(
              "ml-1 inline-flex size-6 items-center justify-center rounded-sm text-fg-muted hover:bg-hover",
              focusRing
            )}
          >
            <ChevronLeft className="size-4" />
          </button>
        ) : null}
        <Command.Input
          autoFocus
          value={search}
          onValueChange={onSearchChange}
          placeholder={`${property.label}…`}
          className={cn(commandInput, "border-b-0")}
        />
      </div>
      <Command.List className="max-h-72 overflow-y-auto p-1">
        <Command.Empty className="px-2 py-3 text-center text-sm text-fg-subtle">
          No results
        </Command.Empty>
        {property.options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <Command.Item
              key={option.value}
              value={`${property.id}:${option.value}`}
              keywords={[option.label]}
              onSelect={() => onToggle(option.value)}
              className={commandItem}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-3.5 items-center justify-center rounded-sm border border-line-strong",
                  checked && "border-accent bg-accent text-accent-fg"
                )}
              >
                {checked ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              {option.icon}
              <span className="flex-1 truncate">{option.label}</span>
              {checked ? <span className="sr-only">selected</span> : null}
            </Command.Item>
          );
        })}
      </Command.List>
    </Command>
  );
}

function FilterChip({
  filter,
  property,
  onChange,
  onRemove,
}: {
  readonly filter: Filter;
  readonly property: FilterProperty;
  readonly onChange: (filter: Filter | null) => void;
  readonly onRemove: () => void;
}) {
  const [search, setSearch] = useState("");
  const many = filter.values.length > 1;
  const names = filter.values.map(
    (v) => property.options.find((o) => o.value === v)?.label ?? v
  );
  const firstIcon =
    filter.values.length === 1
      ? property.options.find((o) => o.value === filter.values[0])?.icon
      : null;
  const valueText =
    names.length > 2
      ? `${names.length} ${property.pluralLabel ?? `${property.label.toLowerCase()}s`}`
      : names.join(", ");

  const segment = cn(
    "inline-flex h-full items-center gap-1.5 px-2 text-fg-muted transition-colors hover:bg-hover hover:text-fg",
    focusRing,
    "focus-visible:ring-inset [&_svg]:size-3.5"
  );

  return (
    // biome-ignore lint/a11y/useSemanticElements: a chip of buttons, not a form fieldset.
    <div
      role="group"
      aria-label={`${property.label} filter`}
      className="inline-flex h-7 items-stretch divide-x divide-line overflow-hidden rounded-md border border-line bg-surface-raised text-xs"
    >
      <span className="inline-flex items-center gap-1.5 px-2 text-fg [&_svg]:size-3.5 [&_svg]:text-fg-muted">
        {property.icon}
        {property.label}
      </span>

      <DropdownMenuPrimitive.Root>
        <DropdownMenuPrimitive.Trigger className={segment}>
          {operatorLabel[filter.operator](many)}
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="start"
            sideOffset={6}
            className={cn(overlayContent, "min-w-36 p-1")}
          >
            {(["is", "is_not"] as const).map((op) => (
              <DropdownMenuPrimitive.Item
                key={op}
                className={menuItem}
                onSelect={() => onChange({ ...filter, operator: op })}
              >
                <span className="flex-1">{operatorLabel[op](many)}</span>
                {filter.operator === op ? <Check /> : null}
              </DropdownMenuPrimitive.Item>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>

      <Popover onOpenChange={(open) => !open && setSearch("")}>
        <PopoverTrigger className={cn(segment, "text-fg")}>
          {firstIcon}
          <span className="max-w-48 truncate">{valueText}</span>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0">
          <ValueList
            property={property}
            selected={filter.values}
            search={search}
            onSearchChange={setSearch}
            onToggle={(value) => {
              const values = filter.values.includes(value)
                ? filter.values.filter((v) => v !== value)
                : [...filter.values, value];
              onChange(values.length ? { ...filter, values } : null);
            }}
          />
        </PopoverContent>
      </Popover>

      <button
        type="button"
        aria-label={`Remove ${property.label} filter`}
        onClick={onRemove}
        className={cn(segment, "px-1.5")}
      >
        <X />
      </button>
    </div>
  );
}

export interface FilterBarProps {
  readonly properties: readonly FilterProperty[];
  readonly value?: readonly Filter[];
  readonly defaultValue?: readonly Filter[];
  readonly onValueChange?: (filters: readonly Filter[]) => void;
  /** Opens the "+ Filter" popover on mount (docs and tests). */
  readonly defaultOpen?: boolean;
  /** Right-aligned extras, e.g. a "Display" button. */
  readonly actions?: ReactNode;
  readonly className?: string;
}

/**
 * Linear-style filters as chips: property → operator → values. "+ Filter" opens a searchable
 * list of properties, then that property's values (multi-select). Every part of a chip is
 * editable; × removes it, "Clear" removes all. Use `matchesFilters` to apply them.
 */
export function FilterBar({
  properties,
  value,
  defaultValue = [],
  onValueChange,
  defaultOpen = false,
  actions,
  className,
}: FilterBarProps) {
  const [filters, setFilters] = useControllable<readonly Filter[]>(
    value,
    defaultValue,
    onValueChange
  );
  const [open, setOpen] = useState(defaultOpen);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const property = properties.find((p) => p.id === propertyId);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPropertyId(null);
      setSearch("");
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 border-b border-line px-4 py-2",
        className
      )}
    >
      {filters.map((filter) => {
        const prop = properties.find((p) => p.id === filter.property);
        if (!prop) return null;
        return (
          <FilterChip
            key={filter.id}
            filter={filter}
            property={prop}
            onChange={(next) =>
              setFilters(
                next
                  ? filters.map((f) => (f.id === filter.id ? next : f))
                  : filters.filter((f) => f.id !== filter.id)
              )
            }
            onRemove={() =>
              setFilters(filters.filter((f) => f.id !== filter.id))
            }
          />
        );
      })}

      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            icon={filters.length === 0 ? <ListFilter /> : undefined}
            aria-label="Add filter"
            className={filters.length > 0 ? "px-2" : undefined}
          >
            {filters.length === 0 ? "Filter" : "+"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-0">
          {property ? (
            <ValueList
              property={property}
              selected={
                filters.find((f) => f.property === property.id)?.values ?? []
              }
              search={search}
              onSearchChange={setSearch}
              onToggle={(v) => setFilters(toggleValue(filters, property.id, v))}
              onBack={() => {
                setPropertyId(null);
                setSearch("");
              }}
            />
          ) : (
            <Command loop>
              <Command.Input
                autoFocus
                value={search}
                onValueChange={setSearch}
                placeholder="Filter…"
                className={commandInput}
              />
              <Command.List className="max-h-72 overflow-y-auto p-1">
                <Command.Empty className="px-2 py-3 text-center text-sm text-fg-subtle">
                  No results
                </Command.Empty>
                {properties.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={p.id}
                    keywords={[p.label]}
                    onSelect={() => {
                      setPropertyId(p.id);
                      setSearch("");
                    }}
                    className={cn(
                      commandItem,
                      "[&_svg]:size-4 [&_svg]:text-fg-muted"
                    )}
                  >
                    {p.icon}
                    <span className="flex-1">{p.label}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          )}
        </PopoverContent>
      </Popover>

      {filters.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => setFilters([])}>
          Clear
        </Button>
      ) : null}

      {actions ? (
        <div className="ml-auto flex items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}
