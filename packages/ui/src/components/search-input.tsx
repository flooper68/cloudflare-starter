import { Search, X } from "lucide-react";
import { useComposedRefs, useControllableState } from "radix-ui/internal";
import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";
import { Input, type InputProps } from "./input";
import { Shortcut } from "./kbd";

export interface SearchInputProps
  extends Omit<
    InputProps,
    "value" | "defaultValue" | "onChange" | "leading" | "trailing" | "type"
  > {
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  /** Called after the clear button or Escape empties the field. */
  readonly onClear?: () => void;
  /**
   * Global shortcut that focuses the field, shown as a hint while it is empty:
   * `"/"` or `"mod+k"` (⌘K on Mac, Ctrl+K elsewhere).
   */
  readonly shortcut?: "/" | "mod+k";
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * A search field with an icon, a clear button and an optional focus shortcut (`/` or ⌘K).
 * Escape clears the text, or leaves the field when it is already empty.
 */
export function SearchInput({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onClear,
  shortcut,
  placeholder = "Search…",
  disabled,
  onKeyDown,
  ref,
  ...props
}: SearchInputProps) {
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composedRef = useComposedRefs(inputRef, ref);

  useEffect(() => {
    if (!shortcut || disabled) return;
    function handle(event: globalThis.KeyboardEvent) {
      const matches =
        shortcut === "/"
          ? event.key === "/" && !isEditable(event.target)
          : event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (!matches) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [shortcut, disabled]);

  function clear() {
    setValue("");
    onClear?.();
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Escape") return;
    if (value) {
      event.preventDefault();
      setValue("");
      onClear?.();
    } else {
      inputRef.current?.blur();
    }
  }

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.userAgent);
  const hint = shortcut === "/" ? ["/"] : [isMac ? "⌘" : "Ctrl", "K"];

  return (
    <Input
      {...props}
      ref={composedRef}
      type="search"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      leading={<Search />}
      trailing={
        value ? (
          <button
            type="button"
            aria-label="Clear search"
            title="Clear search"
            disabled={disabled}
            onClick={clear}
            className={cn(
              "flex size-5 items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg [&_svg]:size-3.5",
              focusRing
            )}
          >
            <X aria-hidden />
          </button>
        ) : shortcut ? (
          <Shortcut keys={hint} className="pointer-events-none" />
        ) : null
      }
      className={cn(
        "[&_input::-webkit-search-cancel-button]:appearance-none",
        shortcut && "[&_input]:pr-12",
        props.className
      )}
    />
  );
}
