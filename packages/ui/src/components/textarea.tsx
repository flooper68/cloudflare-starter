import { useComposedRefs } from "radix-ui/internal";
import type { Ref, TextareaHTMLAttributes } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { controlBase } from "../lib/styles";
import { cn } from "../lib/utils";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with the content instead of scrolling (up to `maxRows`). */
  readonly autoGrow?: boolean;
  /** Height limit for `autoGrow`, in lines; scrolls beyond it. */
  readonly maxRows?: number;
  /** Show "12 / 280" under the field; uses `maxLength` as the limit when set. */
  readonly showCount?: boolean;
  readonly ref?: Ref<HTMLTextAreaElement>;
}

/** 1.25rem line height + 0.375rem padding top and bottom + 1px borders. */
const heightForRows = (rows: number) =>
  `calc(${rows} * 1.25rem + 0.75rem + 2px)`;

/**
 * Multi-line text field, e.g. an issue description. `autoGrow` fits the height to the text,
 * `showCount` adds a character counter that turns amber near `maxLength` and red at it.
 */
export function Textarea({
  className,
  autoGrow = false,
  maxRows,
  rows = 3,
  showCount = false,
  maxLength,
  value,
  defaultValue,
  onChange,
  style,
  ref,
  ...props
}: TextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const composedRef = useComposedRefs(innerRef, ref);
  const [length, setLength] = useState(
    () => String(value ?? defaultValue ?? "").length
  );

  const resize = useCallback(() => {
    const element = innerRef.current;
    if (!element || !autoGrow) return;
    element.style.height = "auto";
    const borders = element.offsetHeight - element.clientHeight;
    element.style.height = `${element.scrollHeight + borders}px`;
  }, [autoGrow]);

  // Re-measure when a controlled value changes from outside.
  useLayoutEffect(() => {
    if (value !== undefined) setLength(String(value).length);
    resize();
  }, [value, resize]);

  const textarea = (
    <textarea
      ref={composedRef}
      rows={rows}
      maxLength={maxLength}
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => {
        setLength(event.target.value.length);
        resize();
        onChange?.(event);
      }}
      style={{
        ...(autoGrow
          ? {
              minHeight: heightForRows(rows),
              maxHeight: maxRows ? heightForRows(maxRows) : undefined,
            }
          : null),
        ...style,
      }}
      className={cn(
        controlBase,
        "block px-2.5 py-1.5",
        autoGrow ? "resize-none overflow-y-auto" : "min-h-16 resize-y",
        !showCount && className
      )}
      {...props}
    />
  );

  if (!showCount) return textarea;

  const ratio = maxLength ? length / maxLength : 0;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {textarea}
      <p
        className={cn(
          "self-end text-2xs text-fg-subtle tabular-nums",
          ratio >= 0.9 && "text-warning",
          ratio >= 1 && "text-danger"
        )}
      >
        {maxLength ? `${length} / ${maxLength}` : `${length} characters`}
      </p>
    </div>
  );
}
