import type { InputHTMLAttributes } from "react";

import { cn } from "../lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-xs outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-950",
        className
      )}
      {...props}
    />
  );
}
