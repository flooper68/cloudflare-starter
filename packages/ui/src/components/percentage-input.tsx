import { useControllableState } from "radix-ui/internal";
import type { Ref } from "react";

import { cn } from "../lib/utils";
import type { FieldControlProps } from "./combobox";
import { NumberInput } from "./number-input";

export interface PercentageInputProps extends FieldControlProps {
  /** Basis points: 0–10000 (100 = 1 %). `null` is an empty field. */
  readonly value?: number | null;
  readonly defaultValue?: number | null;
  readonly onValueChange?: (basisPoints: number | null) => void;
  readonly disabled?: boolean;
  readonly size?: "sm" | "md" | "lg";
  /** Hide the bar that shows the share. */
  readonly hideBar?: boolean;
  readonly className?: string;
  readonly ref?: Ref<HTMLInputElement>;
}

const toPercent = (basisPoints: number | null) =>
  basisPoints === null ? null : basisPoints / 100;
const toBasisPoints = (percent: number | null) =>
  percent === null ? null : Math.round(percent * 100);

/**
 * A share of a population as a percentage with one decimal (0–100 %), stored as
 * basis points (0–10000), as percentage rollouts use them. Arrow keys step by 0.1 %,
 * Shift and Page Up/Down by 1 %; typed values are clamped and rounded to 0.1 %. A bar under the field
 * shows the share at a glance.
 */
export function PercentageInput({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  disabled,
  size = "md",
  hideBar = false,
  className,
  ref,
  ...field
}: PercentageInputProps) {
  const [value, setValue] = useControllableState<number | null>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const percent = toPercent(value);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <NumberInput
        ref={ref}
        value={percent}
        onValueChange={(next) =>
          setValue(next === null ? null : toBasisPoints(next))
        }
        min={0}
        max={100}
        step={0.1}
        unit="%"
        size={size}
        disabled={disabled}
        {...field}
      />
      {hideBar ? null : (
        <div
          aria-hidden
          className="h-1 w-full overflow-hidden rounded-full bg-active"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-150"
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
      )}
    </div>
  );
}
