import type { LabelHTMLAttributes } from "react";

import { cn } from "../lib/utils";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    /* biome-ignore lint/a11y/noLabelWithoutControl: this shared component is validated at usage sites */
    <label
      className={cn("text-sm font-medium text-zinc-700", className)}
      {...props}
    />
  );
}
