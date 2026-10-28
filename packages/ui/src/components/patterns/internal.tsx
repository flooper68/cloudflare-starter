/**
 * Private atoms for the patterns. Not exported from the barrel: they stand in for the shared
 * Avatar, Badge and Checkbox until those exist, and should be swapped for them later.
 */

import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { type ComponentProps, useCallback, useState } from "react";

import { focusRing, menuItem } from "../../lib/styles";
import { cn } from "../../lib/utils";
import { Avatar } from "../avatar";
import { Tag } from "../tag";
import type { IssueLabel, IssueLabelColor, IssuePerson } from "./issue-glyphs";

/** A cmdk row: the shared menu row (it handles cmdk's data-disabled="false"). */
export const commandItem = menuItem;

export const commandInput =
  "h-9 w-full border-b border-line bg-transparent px-3 text-sm text-fg outline-none placeholder:text-fg-subtle";

/** Controlled-or-uncontrolled state, Radix naming. */
export function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void
): [T, (next: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange]
  );
  return [current, set];
}

const avatarSize = { xs: "xs", sm: "xs", md: "sm", lg: "md" } as const;

/** Issue assignee: the shared Avatar, or a dashed circle for "unassigned". */
export function PersonAvatar({
  person,
  size = "sm",
  className,
}: {
  readonly person: IssuePerson | null | undefined;
  readonly size?: keyof typeof avatarSize;
  readonly className?: string;
}) {
  if (!person) {
    return (
      <span
        role="img"
        aria-label="Unassigned"
        className={cn(
          "inline-flex size-5 shrink-0 rounded-full border border-dashed border-fg-subtle",
          size === "xs" && "size-4",
          size === "lg" && "size-6",
          className
        )}
      />
    );
  }
  return (
    <Avatar
      name={person.name}
      src={person.avatarUrl}
      size={avatarSize[size]}
      className={className}
    />
  );
}

export const labelDot: Record<IssueLabelColor, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-fg-subtle",
};

/** An issue label: the shared Tag with the label's colour dot. */
export function LabelChip({
  label,
  className,
}: {
  readonly label: IssueLabel;
  readonly className?: string;
}) {
  return (
    <Tag color={label.color} size="sm" className={cn("max-w-32", className)}>
      {label.name}
    </Tag>
  );
}

export function MiniCheckbox({
  className,
  checked,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-input",
        "transition-colors hover:border-fg-subtle",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-fg",
        focusRing,
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        {checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} />
        ) : (
          <Check className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/** "Oct 31", or "Oct 31, 2027" outside the current year. */
export function formatShortDate(iso: string, now = new Date()): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function isOverdue(iso: string, now = new Date()): boolean {
  const date = new Date(`${iso.slice(0, 10)}T23:59:59`);
  return date.getTime() < now.getTime();
}

/** "just now", "5m ago", "3h ago", "2d ago", else a short date. */
export function formatRelative(date: Date | string, now = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(d.toISOString(), now);
}

/** True when a key event comes from a place where the user is typing. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}
