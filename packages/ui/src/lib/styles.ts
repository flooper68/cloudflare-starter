/**
 * Shared class recipes, so every control, menu and overlay looks and behaves the same.
 * Components compose these with cn(); never copy the strings.
 */

/** Keyboard focus ring (mouse clicks do not show it). */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-0";

/** Text-like controls: input, select trigger, combobox trigger, textarea. */
export const controlBase = [
  "w-full rounded-md border border-line bg-input text-sm text-fg",
  "placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-100",
  "hover:border-line-strong focus-visible:border-accent",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/40",
  "disabled:cursor-not-allowed disabled:opacity-50",
  focusRing,
].join(" ");

/** Control heights, shared by buttons and inputs so they line up in a row. */
export const controlSize = {
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-2.5 text-sm",
  lg: "h-9 px-3 text-sm",
} as const;

/** Floating panels: popover, dropdown, select, combobox, context menu, hover card. */
export const overlayContent = [
  "z-50 rounded-lg border border-line bg-overlay text-sm text-fg shadow-overlay",
  "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
  "origin-(--radix-popper-transform-origin)",
].join(" ");

/** A row in any menu or list of options. Radix sets data-highlighted / data-disabled. */
export const menuItem = [
  "relative flex h-8 w-full cursor-default select-none items-center gap-2 rounded-md px-2",
  "text-sm text-fg outline-none",
  "data-[highlighted]:bg-hover data-[selected=true]:bg-hover",
  // Radix marks disabled items data-disabled=""; cmdk sets data-disabled="true"/"false".
  'data-[disabled=""]:pointer-events-none data-[disabled=""]:opacity-40',
  "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40",
  "[&_svg]:size-4 [&_svg]:shrink-0",
  // Icons are muted unless they carry their own colour (status, priority glyphs).
  "[&_svg:not([class*='text-'])]:text-fg-muted",
].join(" ");

export const menuLabel = "px-2 pt-2 pb-1 text-xs font-medium text-fg-subtle";

export const menuSeparator = "-mx-1 my-1 h-px bg-line";

/** Dimmed page behind dialogs and sheets. */
export const backdrop =
  "fixed inset-0 z-50 bg-backdrop data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out";
