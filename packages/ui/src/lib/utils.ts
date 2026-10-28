import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge that knows the custom scales in styles/theme.css. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["2xs"],
      shadow: ["overlay", "raised"],
      animate: [
        "fade-in",
        "fade-out",
        "pop-in",
        "pop-out",
        "slide-in-right",
        "slide-out-right",
        "slide-in-left",
        "slide-out-left",
        "slide-in-bottom",
        "slide-out-bottom",
        "indeterminate",
        "collapse-down",
        "collapse-up",
        "spin-slow",
        "shimmer",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
