import { ChevronDown, ChevronUp } from "lucide-react";
import { useControllableState } from "radix-ui/internal";
import type { InputHTMLAttributes, KeyboardEvent, ReactNode, Ref } from "react";
import { useState } from "react";

import { controlBase, controlSize } from "../lib/styles";
import { cn } from "../lib/utils";

export interface NumberInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    | "value"
    | "defaultValue"
    | "onChange"
    | "size"
    | "min"
    | "max"
    | "step"
    | "type"
  > {
  /** `null` is an empty field. */
  readonly value?: number | null;
  readonly defaultValue?: number | null;
  readonly onValueChange?: (value: number | null) => void;
  readonly min?: number;
  readonly max?: number;
  /** Arrow keys and the stepper move by this; Shift or Page Up/Down by ten times it. */
  readonly step?: number;
  readonly size?: keyof typeof controlSize;
  /** Unit after the number, e.g. "pts" or "h". */
  readonly unit?: ReactNode;
  /** Hide the up/down buttons (keyboard stepping still works). */
  readonly hideStepper?: boolean;
  readonly ref?: Ref<HTMLInputElement>;
}

function decimalsOf(step: number) {
  const text = String(step);
  return text.includes(".") ? text.length - text.indexOf(".") - 1 : 0;
}

/**
 * A number field with a stepper. Typing is free; the value is parsed, clamped to
 * `min`/`max` and rounded to `step` on Enter or blur. ArrowUp/Down step, Shift steps by
 * ten, Home/End jump to `min`/`max`.
 */
export function NumberInput({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  min,
  max,
  step = 1,
  size = "md",
  unit,
  hideStepper = false,
  className,
  disabled,
  readOnly,
  onKeyDown,
  onBlur,
  ...props
}: NumberInputProps) {
  const [value, setValue] = useControllableState<number | null>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  /** Text while the user is typing; null shows the formatted value. */
  const [draft, setDraft] = useState<string | null>(null);
  const decimals = decimalsOf(step);

  function normalize(next: number) {
    let result = next;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return Number(result.toFixed(decimals));
  }

  function parse(text: string) {
    const parsed = Number(text.trim().replace(",", "."));
    return text.trim() === "" || Number.isNaN(parsed) ? null : parsed;
  }

  function commit() {
    if (draft === null) return;
    if (draft.trim() === "") setValue(null);
    else {
      const parsed = parse(draft);
      if (parsed !== null) setValue(normalize(parsed));
    }
    setDraft(null);
  }

  function stepBy(direction: 1 | -1, multiplier = 1) {
    const current = (draft === null ? value : parse(draft)) ?? min ?? 0;
    setValue(normalize(current + direction * step * multiplier));
    setDraft(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || readOnly) return;
    const big = event.shiftKey ? 10 : 1;
    switch (event.key) {
      case "ArrowUp":
        stepBy(1, big);
        break;
      case "ArrowDown":
        stepBy(-1, big);
        break;
      case "PageUp":
        stepBy(1, 10);
        break;
      case "PageDown":
        stepBy(-1, 10);
        break;
      case "Home":
        if (min !== undefined) setValue(min);
        break;
      case "End":
        if (max !== undefined) setValue(max);
        break;
      case "Enter":
        commit();
        return;
      default:
        return;
    }
    event.preventDefault();
    setDraft(null);
  }

  const atMin = min !== undefined && value !== null && value <= min;
  const atMax = max !== undefined && value !== null && value >= max;
  const text = draft ?? (value === null ? "" : String(value));

  const stepButton =
    "flex flex-1 items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        type="text"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        role="spinbutton"
        aria-valuenow={value ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        autoComplete="off"
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          commit();
          onBlur?.(event);
        }}
        className={cn(
          controlBase,
          controlSize[size],
          "tabular-nums",
          !hideStepper && "pr-7",
          unit && !hideStepper && "pr-14",
          unit && hideStepper && "pr-10"
        )}
        {...props}
      />
      {unit ? (
        <span
          className={cn(
            "pointer-events-none absolute text-fg-subtle text-xs",
            hideStepper ? "right-2.5" : "right-7"
          )}
        >
          {unit}
        </span>
      ) : null}
      {hideStepper ? null : (
        <div className="absolute inset-y-1 right-1 flex w-5 flex-col [&_svg]:size-3">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Increase"
            disabled={disabled || readOnly || atMax}
            onClick={() => stepBy(1)}
            className={stepButton}
          >
            <ChevronUp aria-hidden />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Decrease"
            disabled={disabled || readOnly || atMin}
            onClick={() => stepBy(-1)}
            className={stepButton}
          >
            <ChevronDown aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
