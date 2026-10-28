import { Command } from "cmdk";
import { Check } from "lucide-react";
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from "react";

import { focusRing } from "../../lib/styles";
import { cn } from "../../lib/utils";
import { Kbd } from "../kbd";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { commandInput, commandItem, PersonAvatar } from "./internal";
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type IssuePerson,
  type IssuePriority,
  type IssueStatus,
  PriorityIcon,
  StatusIcon,
} from "./issue-glyphs";

interface PickerOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly icon: ReactNode;
  readonly keywords?: string[];
}

interface OptionPickerProps<T extends string> {
  readonly options: readonly PickerOption<T>[];
  readonly value: T;
  readonly onValueChange: (value: T) => void;
  readonly placeholder: string;
  readonly children: ReactNode;
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Number keys 1..9 pick the nth option, shown on the right. */
  readonly numberShortcuts?: boolean;
  readonly align?: "start" | "center" | "end";
}

function OptionPicker<T extends string>({
  options,
  value,
  onValueChange,
  placeholder,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  numberShortcuts = true,
  align = "start",
}: OptionPickerProps<T>) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = openProp ?? innerOpen;
  const [search, setSearch] = useState("");

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
    if (!next) setSearch("");
  };

  const pick = (next: T) => {
    onValueChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!numberShortcuts || search !== "") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const n = Number.parseInt(event.key, 10);
    if (Number.isNaN(n) || n < 1 || n > Math.min(options.length, 9)) return;
    const option = options[n - 1];
    if (!option) return;
    event.preventDefault();
    pick(option.value);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-60 p-0"
        // The content is portalled, but React events still bubble to the row or card.
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Command loop onKeyDown={onKeyDown} defaultValue={value}>
          <Command.Input
            autoFocus
            value={search}
            onValueChange={setSearch}
            placeholder={placeholder}
            className={commandInput}
          />
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="px-2 py-3 text-center text-sm text-fg-subtle">
              No results
            </Command.Empty>
            {options.map((option, index) => (
              <Command.Item
                key={option.value}
                value={option.value}
                keywords={[option.label, ...(option.keywords ?? [])]}
                onSelect={() => pick(option.value)}
                className={commandItem}
              >
                {option.icon}
                <span className="flex-1 truncate">{option.label}</span>
                {option.value === value ? (
                  <Check
                    className="size-4 text-fg-muted"
                    aria-label="Current"
                  />
                ) : null}
                {numberShortcuts && index < 9 ? (
                  <Kbd className="ml-1">{index + 1}</Kbd>
                ) : null}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface BasePickerProps {
  /** The trigger, usually the glyph button. */
  readonly children: ReactNode;
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly align?: "start" | "center" | "end";
}

export interface StatusPickerProps extends BasePickerProps {
  readonly value: IssueStatus;
  readonly onValueChange: (status: IssueStatus) => void;
}

/** Popover to change an issue's status: search, number-key shortcuts, check on the current one. */
export function StatusPicker({
  value,
  onValueChange,
  ...props
}: StatusPickerProps) {
  return (
    <OptionPicker
      options={ISSUE_STATUSES.map((s) => ({
        value: s.value,
        label: s.label,
        icon: <StatusIcon status={s.value} />,
      }))}
      value={value}
      onValueChange={onValueChange}
      placeholder="Change status…"
      {...props}
    />
  );
}

export interface PriorityPickerProps extends BasePickerProps {
  readonly value: IssuePriority;
  readonly onValueChange: (priority: IssuePriority) => void;
}

/** Popover to change an issue's priority; 0–4 style number shortcuts as in Linear (1..5 here). */
export function PriorityPicker({
  value,
  onValueChange,
  ...props
}: PriorityPickerProps) {
  return (
    <OptionPicker
      options={ISSUE_PRIORITIES.map((p) => ({
        value: p.value,
        label: p.label,
        icon: <PriorityIcon priority={p.value} />,
      }))}
      value={value}
      onValueChange={onValueChange}
      placeholder="Set priority…"
      {...props}
    />
  );
}

export interface AssigneePickerProps extends BasePickerProps {
  readonly people: readonly IssuePerson[];
  /** Person id, or null for unassigned. */
  readonly value: string | null;
  readonly onValueChange: (personId: string | null) => void;
}

const UNASSIGNED = "__unassigned__";

/** Popover to assign an issue to someone; searchable by name. */
export function AssigneePicker({
  people,
  value,
  onValueChange,
  ...props
}: AssigneePickerProps) {
  return (
    <OptionPicker
      numberShortcuts={false}
      options={[
        {
          value: UNASSIGNED,
          label: "No assignee",
          icon: <PersonAvatar person={null} size="xs" />,
        },
        ...people.map((p) => ({
          value: p.id,
          label: p.name,
          icon: <PersonAvatar person={p} size="xs" />,
        })),
      ]}
      value={value ?? UNASSIGNED}
      onValueChange={(next) => onValueChange(next === UNASSIGNED ? null : next)}
      placeholder="Assign to…"
      {...props}
    />
  );
}

/** The small square button that opens a picker from a glyph (rows, cards). */
export function GlyphButton({
  label,
  className,
  children,
  ...props
}: {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted",
        "transition-colors hover:bg-active",
        focusRing,
        "data-[state=open]:bg-active",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
