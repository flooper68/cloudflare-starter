import { useComposedRefs, useControllableState } from "radix-ui/internal";
import type {
  ClipboardEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  Ref,
} from "react";
import { useRef, useState } from "react";

import { controlBase } from "../lib/styles";
import { cn } from "../lib/utils";
import { Chip } from "./multi-select";

export interface TagInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue" | "onChange" | "size"
  > {
  readonly value?: readonly string[];
  readonly defaultValue?: readonly string[];
  readonly onValueChange?: (tags: readonly string[]) => void;
  /**
   * Checks a tag before it is added; return an error message to reject it. Duplicates
   * (case-insensitive) are always rejected with "Already added".
   */
  readonly validate?: (
    tag: string,
    tags: readonly string[]
  ) => string | null | undefined;
  /** Called with the rejection message, or null once the user types again. */
  readonly onValidationError?: (message: string | null) => void;
  /** Stop accepting tags at this count. */
  readonly maxTags?: number;
  /** Add the typed text when the field loses focus. */
  readonly addOnBlur?: boolean;
  readonly size?: "sm" | "md" | "lg";
  readonly ref?: Ref<HTMLInputElement>;
}

const minHeight = { sm: "min-h-7", md: "min-h-8", lg: "min-h-9" } as const;

/**
 * Free-text tags: Enter or comma adds the typed text, Backspace in the empty field removes
 * the last tag, pasting "a, b, c" adds three. Use `validate` for rules such as an email
 * format, and show its message through `<Field error>`.
 */
export function TagInput({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  validate,
  onValidationError,
  maxTags,
  addOnBlur = true,
  size = "md",
  className,
  disabled,
  placeholder = "Add…",
  onKeyDown,
  onBlur,
  ref,
  ...props
}: TagInputProps) {
  const [tags, setTags] = useControllableState<readonly string[]>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composedRef = useComposedRefs(inputRef, ref);
  const full = maxTags !== undefined && tags.length >= maxTags;

  /** Adds each candidate that passes; returns false when any was rejected. */
  function add(candidates: readonly string[]) {
    let next = tags;
    for (const raw of candidates) {
      const tag = raw.trim();
      if (!tag) continue;
      if (maxTags !== undefined && next.length >= maxTags) {
        onValidationError?.(`Up to ${maxTags} tags`);
        return false;
      }
      const message = next.some(
        (item) => item.toLowerCase() === tag.toLowerCase()
      )
        ? "Already added"
        : validate?.(tag, next);
      if (message) {
        onValidationError?.(message);
        if (next !== tags) setTags(next);
        return false;
      }
      next = [...next, tag];
    }
    if (next !== tags) setTags(next);
    onValidationError?.(null);
    return true;
  }

  function remove(index: number) {
    setTags(tags.filter((_, position) => position !== index));
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
      event.preventDefault();
      if (add([draft])) setDraft("");
    } else if (event.key === "," || (event.key === "Enter" && !draft.trim())) {
      // Do not type a lone comma or submit the form from an empty tag field.
      if (event.key === ",") event.preventDefault();
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/[,\n]/.test(text)) return;
    event.preventDefault();
    if (add(text.split(/[,\n]/))) setDraft("");
  }

  return (
    // The wrapper forwards clicks to the input; the input itself is the keyboard target.
    // biome-ignore lint/a11y/noStaticElementInteractions: click-to-focus convenience only.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the inner input handles the keyboard.
    <div
      aria-disabled={disabled || undefined}
      aria-invalid={props["aria-invalid"]}
      onClick={() => inputRef.current?.focus()}
      className={cn(
        controlBase,
        minHeight[size],
        "flex cursor-text flex-wrap items-center gap-1 px-1.5 py-1",
        "has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
        "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
        className
      )}
    >
      {tags.map((tag, index) => (
        <Chip
          key={tag}
          disabled={disabled}
          removeLabel={`Remove ${tag}`}
          onRemove={() => remove(index)}
        >
          {tag}
        </Chip>
      ))}
      <input
        {...props}
        ref={composedRef}
        value={draft}
        disabled={disabled}
        placeholder={full ? undefined : placeholder}
        readOnly={full}
        onChange={(event) => {
          setDraft(event.target.value);
          onValidationError?.(null);
        }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={(event) => {
          onBlur?.(event);
          if (addOnBlur && draft.trim() && add([draft])) setDraft("");
        }}
        className={cn(
          "h-5 min-w-20 flex-1 bg-transparent px-1 text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed",
          size === "sm" ? "text-xs" : "text-sm"
        )}
      />
    </div>
  );
}
