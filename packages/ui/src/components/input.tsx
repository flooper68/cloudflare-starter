import type { InputHTMLAttributes, ReactNode, Ref } from "react";

import { controlBase, controlSize } from "../lib/styles";
import { cn } from "../lib/utils";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  readonly size?: keyof typeof controlSize;
  /** Icon or text inside the field, before the value (e.g. a search icon). */
  readonly leading?: ReactNode;
  /** Icon, unit or shortcut inside the field, after the value. */
  readonly trailing?: ReactNode;
  readonly ref?: Ref<HTMLInputElement>;
}

/** Single-line text field. Set aria-invalid for the error style. */
export function Input({
  className,
  size = "md",
  leading,
  trailing,
  ...props
}: InputProps) {
  if (!leading && !trailing) {
    return (
      <input
        className={cn(controlBase, controlSize[size], className)}
        {...props}
      />
    );
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      {leading ? (
        <span className="pointer-events-none absolute left-2.5 flex text-fg-subtle [&_svg]:size-4">
          {leading}
        </span>
      ) : null}
      <input
        className={cn(
          controlBase,
          controlSize[size],
          leading && "pl-8",
          trailing && "pr-8"
        )}
        {...props}
      />
      {trailing ? (
        <span className="absolute right-2 flex text-fg-subtle [&_svg]:size-4">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}
