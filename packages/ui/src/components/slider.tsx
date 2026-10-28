import { Slider as SliderPrimitive } from "radix-ui";
import { useControllableState } from "radix-ui/internal";
import type { ComponentProps } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

export interface SliderProps
  extends ComponentProps<typeof SliderPrimitive.Root> {
  /** Show the current value (or range) to the right of the track. */
  readonly showValue?: boolean;
  /** Formats each value for the label and for screen readers, e.g. `(v) => \`${v}%\``. */
  readonly formatValue?: (value: number) => string;
  /** Accessible names per thumb, e.g. `["Minimum", "Maximum"]` for a range. */
  readonly thumbLabels?: readonly string[];
}

/**
 * Pick a number (one thumb) or a range (two thumbs: pass two values) by dragging or with
 * the arrow keys (Shift or Page Up/Down for bigger steps).
 */
export function Slider({
  value: valueProp,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  showValue = false,
  formatValue = String,
  thumbLabels,
  className,
  ...props
}: SliderProps) {
  const [value, setValue] = useControllableState<number[]>({
    prop: valueProp,
    defaultProp: defaultValue ?? [min],
    onChange: onValueChange,
  });

  const slider = (
    <SliderPrimitive.Root
      value={value}
      onValueChange={setValue}
      min={min}
      max={max}
      className={cn(
        "relative flex h-4 w-full touch-none select-none items-center",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        !showValue && className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-active">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
      </SliderPrimitive.Track>
      {value.map((thumbValue, index) => (
        <SliderPrimitive.Thumb
          // Thumbs are positional; Radix keeps them sorted.
          // biome-ignore lint/suspicious/noArrayIndexKey: a thumb is identified by its position.
          key={index}
          aria-label={thumbLabels?.[index]}
          aria-valuetext={formatValue(thumbValue)}
          className={cn(
            "block size-3.5 rounded-full border border-line-strong bg-thumb shadow-raised",
            "transition-transform duration-100 hover:scale-110 active:scale-110",
            focusRing
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );

  if (!showValue) return slider;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {slider}
      <output className="min-w-10 shrink-0 text-right text-fg-muted text-xs tabular-nums">
        {value.map((item) => formatValue(item)).join(" – ")}
      </output>
    </div>
  );
}
