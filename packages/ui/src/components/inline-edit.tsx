import { useControllableState } from "radix-ui/internal";
import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

const variants = {
  /** An issue or project title. */
  title: "text-xl font-semibold tracking-tight",
  /** A property value in a list or sidebar. */
  body: "text-sm",
} as const;

export interface InlineEditProps {
  readonly value?: string;
  readonly defaultValue?: string;
  /** Called with the new text when an edit is saved (Enter or blur), not on every key. */
  readonly onValueChange?: (value: string) => void;
  /** Shown, dimmed, when the value is empty. */
  readonly placeholder?: string;
  readonly variant?: keyof typeof variants;
  /** Reject empty text (the previous value is kept). */
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly disabled?: boolean;
  /** Accessible name of the field, e.g. "Issue title". */
  readonly label: string;
  readonly className?: string;
}

/**
 * Text that becomes an input on click or Enter, like an issue title in Linear. Enter or
 * leaving the field saves, Escape cancels. The text keeps its size and position while
 * editing, so nothing jumps.
 */
export function InlineEdit({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  placeholder = "Untitled",
  variant = "body",
  required = false,
  maxLength,
  disabled = false,
  label,
  className,
}: InlineEditProps) {
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const [draft, setDraft] = useState<string | null>(null);
  const displayRef = useRef<HTMLButtonElement>(null);
  /** Set once Enter or Escape finished the edit, so the blur that follows does nothing. */
  const finishedRef = useRef(false);
  const editing = draft !== null;

  function finish(save: boolean) {
    if (draft === null || finishedRef.current) return;
    finishedRef.current = true;
    const next = draft.trim();
    if (save && next !== value && !(required && next === "")) setValue(next);
    setDraft(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
      // Return focus to the text so Enter can start another edit.
      requestAnimationFrame(() => displayRef.current?.focus());
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
      requestAnimationFrame(() => displayRef.current?.focus());
    }
  }

  const shared = cn(
    "-mx-1.5 block w-[calc(100%+0.75rem)] rounded-md px-1.5 py-0.5 text-left text-fg",
    variants[variant],
    className
  );

  if (editing) {
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: the user just asked to edit this text.
        autoFocus
        aria-label={label}
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => finish(true)}
        onFocus={(event) => event.target.select()}
        className={cn(
          shared,
          "bg-input outline-none ring-1 ring-accent placeholder:text-fg-subtle"
        )}
      />
    );
  }

  return (
    <button
      ref={displayRef}
      type="button"
      aria-label={`${label}: ${value || placeholder}. Press Enter to edit`}
      disabled={disabled}
      onClick={() => {
        finishedRef.current = false;
        setDraft(value);
      }}
      className={cn(
        shared,
        "cursor-text truncate transition-colors duration-100 hover:bg-hover",
        "disabled:cursor-default disabled:hover:bg-transparent",
        !value && "text-fg-subtle",
        focusRing
      )}
    >
      {value || placeholder}
    </button>
  );
}
