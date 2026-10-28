import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

const track = {
  sm: "h-4 w-7",
  md: "h-5 w-9",
} as const;

const thumb = {
  sm: "size-3 data-[state=checked]:translate-x-3",
  md: "size-4 data-[state=checked]:translate-x-4",
} as const;

export interface SwitchProps
  extends ComponentProps<typeof SwitchPrimitive.Root> {
  readonly size?: keyof typeof track;
  /** Text next to the switch; clicking it toggles. */
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  /** `before` puts the label first and the switch at the far right, like a settings row. */
  readonly labelPosition?: "after" | "before";
}

/**
 * An on/off setting that applies immediately (no Save button). For a choice submitted with
 * a form, use Checkbox.
 */
export function Switch({
  size = "md",
  label,
  description,
  labelPosition = "after",
  className,
  id: idProp,
  ...props
}: SwitchProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;

  const control = (
    <SwitchPrimitive.Root
      id={id}
      aria-describedby={descriptionId}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent p-px",
        "bg-active transition-colors duration-150 hover:bg-line-strong",
        "data-[state=checked]:bg-accent data-[state=checked]:hover:bg-accent-hover",
        "disabled:cursor-not-allowed disabled:opacity-50",
        track[size],
        focusRing,
        !label && className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-thumb shadow-raised transition-transform duration-150",
          "translate-x-0",
          thumb[size]
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return control;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5",
        labelPosition === "before" && "flex-row-reverse justify-between gap-6",
        className
      )}
    >
      <div className="flex h-5 items-center">{control}</div>
      {/* Disabled dims the label to muted, not opacity: the text still reaches 4.5:1. */}
      <div className="flex flex-col">
        <label
          htmlFor={id}
          className={cn(
            "cursor-pointer select-none text-fg text-sm",
            props.disabled && "cursor-not-allowed text-fg-muted"
          )}
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-fg-subtle text-xs">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
