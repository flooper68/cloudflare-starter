import { Command, useCommandState } from "cmdk";
import type { ComponentProps } from "react";

import { cn } from "./utils";

/**
 * cmdk's list (`role="listbox"`), hidden while no option matches. A listbox may only
 * contain options and groups (axe `aria-required-children`), so empty, loading and error
 * messages render next to the list, never inside it; hiding the empty list keeps it out
 * of the accessibility tree and drops its padding.
 */
export function CommandList({
  forceVisible = false,
  ...props
}: ComponentProps<typeof Command.List> & {
  /** Keep it visible although nothing matches: it holds a `forceMount` item (Create, Clear). */
  readonly forceVisible?: boolean;
}) {
  const empty = useCommandState((state) => state.filtered.count === 0);
  return (
    <Command.List hidden={(empty && !forceVisible) || undefined} {...props} />
  );
}

export interface CommandListSeparatorProps {
  /** Keep it while the user searches (cmdk's separators hide during a search). */
  readonly alwaysRender?: boolean;
  readonly className?: string;
}

/**
 * A divider between groups inside a listbox. Decorative (`aria-hidden`), because a
 * listbox may not contain `role="separator"`, which cmdk's own separator renders.
 */
export function CommandListSeparator({
  alwaysRender = false,
  className,
}: CommandListSeparatorProps) {
  const searching = useCommandState((state) => state.search !== "");
  if (searching && !alwaysRender) return null;
  return <div aria-hidden className={cn("h-px bg-line", className)} />;
}
