import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

export interface CheckboxProps
  extends ComponentProps<typeof CheckboxPrimitive.Root> {
  /** Text next to the box; clicking it toggles the box. */
  readonly label?: ReactNode;
  /** Secondary line under the label. */
  readonly description?: ReactNode;
}

/**
 * A checkbox; `checked` can be `true`, `false` or `"indeterminate"` (e.g. "select all" when
 * some rows are selected). With `label` it renders the clickable text next to the box.
 */
export function Checkbox({
  label,
  description,
  className,
  id: idProp,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  const box = (
    <CheckboxPrimitive.Root
      id={id}
      aria-describedby={
        description && !props["aria-describedby"]
          ? `${id}-description`
          : props["aria-describedby"]
      }
      className={cn(
        "peer flex size-4 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-input",
        "transition-colors duration-100 hover:border-fg-subtle",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-fg",
        "aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        !label && className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="group flex items-center justify-center">
        <Check
          aria-hidden
          strokeWidth={3}
          className="size-3 group-data-[state=indeterminate]:hidden"
        />
        <Minus
          aria-hidden
          strokeWidth={3}
          className="hidden size-3 group-data-[state=indeterminate]:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return box;

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="flex h-5 items-center">{box}</div>
      <div className="flex flex-col">
        <label
          htmlFor={id}
          className={cn(
            "cursor-pointer select-none text-fg text-sm",
            props.disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {label}
        </label>
        {description ? (
          <p
            id={`${id}-description`}
            className={cn(
              "text-fg-subtle text-xs",
              props.disabled && "opacity-50"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
