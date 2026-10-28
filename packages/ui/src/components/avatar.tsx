import { Avatar as AvatarPrimitive } from "radix-ui";
import {
  Children,
  createContext,
  type HTMLAttributes,
  isValidElement,
  type ReactNode,
  type Ref,
  useContext,
} from "react";

import { cn } from "../lib/utils";
import type { Tone } from "./badge";

const avatarSize = {
  xs: "size-4 text-[8px]",
  sm: "size-5 text-[9px]",
  md: "size-6 text-2xs",
  lg: "size-8 text-xs",
} as const;

const statusSize = {
  xs: "size-1.5",
  sm: "size-2",
  md: "size-2",
  lg: "size-2.5",
} as const;

export type AvatarSize = keyof typeof avatarSize;
export type AvatarStatus = "online" | "away" | "busy" | "offline";

const statusColour: Record<AvatarStatus, string> = {
  online: "bg-success",
  away: "bg-warning",
  busy: "bg-danger",
  offline: "bg-fg-subtle",
};

const fallbackTone: Record<Exclude<Tone, "neutral">, string> = {
  accent: "bg-accent-subtle text-accent",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
};
const fallbackTones = Object.keys(fallbackTone) as Array<
  keyof typeof fallbackTone
>;

/** "Ada Lovelace" → "AL", "linear" → "LI". */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** The same name always gets the same colour, so people are recognisable at a glance. */
export function getAvatarTone(name: string): Exclude<Tone, "neutral"> {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return fallbackTones[Math.abs(hash) % fallbackTones.length];
}

const AvatarSizeContext = createContext<AvatarSize | undefined>(undefined);

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Full name: the accessible name, the initials and the fallback colour. */
  readonly name: string;
  /** Image URL. Falls back to initials while loading or when it fails. */
  readonly src?: string;
  /** Defaults to the size of the surrounding AvatarGroup, else `md`. */
  readonly size?: AvatarSize;
  /** Presence dot in the bottom-right corner. */
  readonly status?: AvatarStatus;
  /** `square` for teams, workspaces and bots. */
  readonly shape?: "circle" | "square";
  readonly ref?: Ref<HTMLSpanElement>;
}

/** A person (or team) picture with an initials fallback in a colour derived from the name. */
export function Avatar({
  name,
  src,
  size: sizeProp,
  status,
  shape = "circle",
  className,
  ...props
}: AvatarProps) {
  const groupSize = useContext(AvatarSizeContext);
  const size = sizeProp ?? groupSize ?? "md";
  const radius = shape === "circle" ? "rounded-full" : "rounded-sm";

  return (
    <span className={cn("relative inline-flex shrink-0", className)} {...props}>
      <AvatarPrimitive.Root
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center overflow-hidden",
          avatarSize[size],
          radius
        )}
      >
        {src ? (
          <AvatarPrimitive.Image
            src={src}
            alt={name}
            className="size-full object-cover"
          />
        ) : null}
        <AvatarPrimitive.Fallback
          delayMs={src ? 300 : 0}
          role="img"
          aria-label={name}
          className={cn(
            "flex size-full items-center justify-center font-semibold leading-none",
            fallbackTone[getAvatarTone(name)]
          )}
        >
          {getInitials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {status ? (
        <span
          role="img"
          aria-label={status}
          className={cn(
            "absolute -right-px -bottom-px rounded-full ring-2 ring-canvas",
            statusSize[size],
            statusColour[status]
          )}
        />
      ) : null}
    </span>
  );
}

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Avatars to show; extra ones collapse into "+N". */
  readonly children: ReactNode;
  /** How many avatars to show before "+N". */
  readonly max?: number;
  readonly size?: AvatarSize;
}

/** Overlapping avatars of the people on a project or issue, with a "+N" for the rest. */
export function AvatarGroup({
  children,
  max = 4,
  size = "md",
  className,
  ...props
}: AvatarGroupProps) {
  const items = Children.toArray(children).filter(isValidElement);
  const visible = items.slice(0, max);
  const hidden = items.length - visible.length;

  return (
    <AvatarSizeContext.Provider value={size}>
      <div
        className={cn("flex items-center -space-x-1.5", className)}
        {...props}
      >
        {visible.map((item) => (
          <span
            key={item.key}
            className="inline-flex rounded-full ring-2 ring-canvas"
          >
            {item}
          </span>
        ))}
        {hidden > 0 ? (
          <span
            role="img"
            aria-label={`${hidden} more`}
            className={cn(
              "inline-flex items-center justify-center rounded-full bg-surface-raised font-medium text-fg-muted ring-2 ring-canvas",
              avatarSize[size]
            )}
          >
            +{hidden}
          </span>
        ) : null}
      </div>
    </AvatarSizeContext.Provider>
  );
}
