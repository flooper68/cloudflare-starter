import { cn } from "../lib/utils";

export interface SpinnerProps {
  readonly className?: string;
  /** Accessible label; omit when the surrounding text already says it is loading. */
  readonly label?: string;
}

/** A small ring spinner that inherits the text colour. */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-4 animate-spin-slow", className)}
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.75"
      />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
