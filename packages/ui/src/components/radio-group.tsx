import { Check } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext, useId } from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

type RadioVariant = "default" | "card";

const VariantContext = createContext<RadioVariant>("default");

export interface RadioGroupProps
  extends ComponentProps<typeof RadioGroupPrimitive.Root> {
  /** `default`: dot and label. `card`: each option is a bordered, clickable card. */
  readonly variant?: RadioVariant;
}

/**
 * One choice out of a few visible options. Arrow keys move between items. Use `variant="card"`
 * for choices that need a description (plans, visibility, templates); use Select or
 * SegmentedControl when space is tight.
 */
export function RadioGroup({
  variant = "default",
  orientation = "vertical",
  className,
  ...props
}: RadioGroupProps) {
  return (
    <VariantContext value={variant}>
      <RadioGroupPrimitive.Root
        orientation={orientation}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
          variant === "card"
            ? "gap-2"
            : orientation === "vertical"
              ? "gap-2.5"
              : "gap-x-5 gap-y-2",
          className
        )}
        {...props}
      />
    </VariantContext>
  );
}

export interface RadioGroupItemProps
  extends Omit<ComponentProps<typeof RadioGroupPrimitive.Item>, "children"> {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  /** Card variant only: icon in the top-left of the card. */
  readonly icon?: ReactNode;
}

/** An option of a RadioGroup; looks like a dot with a label, or a card. */
export function RadioGroupItem({
  label,
  description,
  icon,
  className,
  id: idProp,
  ...props
}: RadioGroupItemProps) {
  const variant = useContext(VariantContext);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const descriptionId = description ? `${id}-description` : undefined;

  if (variant === "card") {
    return (
      <RadioGroupPrimitive.Item
        id={id}
        aria-describedby={descriptionId}
        className={cn(
          "group relative flex flex-1 items-start gap-3 rounded-lg border border-line bg-surface-raised p-3 text-left",
          "transition-colors duration-100 hover:border-line-strong hover:bg-hover",
          "data-[state=checked]:border-accent data-[state=checked]:bg-accent-subtle",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&_svg]:size-4 [&_svg]:shrink-0",
          focusRing,
          className
        )}
        {...props}
      >
        {icon ? (
          <span className="mt-0.5 flex text-fg-muted group-data-[state=checked]:text-accent">
            {icon}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium text-fg text-sm">{label}</span>
          {description ? (
            <span id={descriptionId} className="text-fg-muted text-xs">
              {description}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex size-4 items-center justify-center rounded-full border border-line-strong group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent">
          <RadioGroupPrimitive.Indicator asChild>
            <Check
              aria-hidden
              strokeWidth={3}
              className="size-2.5! text-accent-fg"
            />
          </RadioGroupPrimitive.Indicator>
        </span>
      </RadioGroupPrimitive.Item>
    );
  }

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="flex h-5 items-center">
        <RadioGroupPrimitive.Item
          id={id}
          aria-describedby={descriptionId}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong bg-input",
            "transition-colors duration-100 hover:border-fg-subtle",
            "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            focusRing
          )}
          {...props}
        >
          <RadioGroupPrimitive.Indicator className="size-1.5 rounded-full bg-accent-fg" />
        </RadioGroupPrimitive.Item>
      </div>
      <div className={cn("flex flex-col", props.disabled && "opacity-50")}>
        <label
          htmlFor={id}
          className="cursor-pointer select-none text-fg text-sm"
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
