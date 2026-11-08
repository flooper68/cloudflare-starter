import { Command as CommandPrimitive, useCommandState } from "cmdk";
import { ChevronRight, CircleAlert, Search } from "lucide-react";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  CommandList,
  CommandListSeparator,
  type CommandListSeparatorProps,
} from "../lib/command-list";
import { backdrop, focusRing, menuItem } from "../lib/styles";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Kbd, Shortcut } from "./kbd";
import { Spinner } from "./spinner";

const ROOT_PAGE = "root";

/**
 * Where CommandEmpty and CommandLoading render: below the list, not inside it, because a
 * listbox may only contain options and groups.
 */
const StatusSlotContext = createContext<HTMLElement | null>(null);

function StatusSlot({ children }: { readonly children: ReactNode }) {
  const slot = useContext(StatusSlotContext);
  return slot ? createPortal(children, slot) : children;
}

interface PageEntry {
  readonly id: string;
  readonly title?: ReactNode;
  readonly placeholder?: string;
}

export interface PushPageOptions {
  /** Shown as a breadcrumb chip above the input. */
  readonly title?: ReactNode;
  /** Placeholder of the input on that page. */
  readonly placeholder?: string;
}

export interface CommandPagesApi {
  /** Id of the page on screen; "root" at the start. */
  readonly page: string;
  /** Opens a nested page (e.g. "Change status…"). Clears the search. */
  readonly push: (id: string, options?: PushPageOptions) => void;
  /** Goes back one page; Backspace on an empty input and Escape do the same. */
  readonly pop: () => void;
  /** Closes the palette (call it after running a command). */
  readonly close: () => void;
}

const CommandPaletteContext = createContext<CommandPagesApi | null>(null);

/** Page navigation inside a CommandPalette: `push`, `pop`, `close`. */
export function useCommandPages(): CommandPagesApi {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPages must be used inside <CommandPalette>");
  }
  return context;
}

export interface UseCommandPaletteResult {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly toggle: () => void;
}

/**
 * Open state for a CommandPalette, toggled by ⌘K (macOS) or Ctrl+K (elsewhere).
 * Spread the result: `<CommandPalette open={open} onOpenChange={setOpen}>`.
 */
export function useCommandPalette({
  key = "k",
  enabled = true,
}: {
  readonly key?: string;
  readonly enabled?: boolean;
} = {}): UseCommandPaletteResult {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === key
      ) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, enabled]);

  return { open, setOpen, toggle };
}

export interface CommandPaletteProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Placeholder on the root page. */
  readonly placeholder?: string;
  /** What the commands act on, shown as the first chip above the input (e.g. "ENG-142"). */
  readonly context?: ReactNode;
  /** Replaces the key hints at the bottom; `false` hides the footer. */
  readonly footer?: ReactNode | false;
  /** Accessible name of the palette. */
  readonly label?: string;
  /** CommandPage elements (or groups and items directly, for a single page). */
  readonly children: ReactNode;
  readonly className?: string;
  /** Controlled search text (with `onSearchChange`); uncontrolled when left out. */
  readonly search?: string;
  readonly onSearchChange?: (search: string) => void;
  /**
   * `false` shows every item as given: the caller filters (fixed group order, or results
   * that come from a server search and need no client-side match).
   */
  readonly shouldFilter?: boolean;
  /** Below the `sm` breakpoint the palette fills the screen and gets a Cancel button. */
  readonly fullScreenOnMobile?: boolean;
  /** Where focus goes when the palette closes (Radix `onCloseAutoFocus`). */
  readonly onCloseAutoFocus?: (event: Event) => void;
}

/**
 * The ⌘K command palette: a search field over grouped commands, with nested pages
 * ("Change status…" opens a second list; Backspace or Escape goes back), shortcut hints
 * and a key-hint footer. Pair it with `useCommandPalette()` for the global shortcut.
 */
export function CommandPalette({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placeholder = "Type a command or search…",
  context,
  footer,
  label = "Command palette",
  children,
  className,
  search: searchProp,
  onSearchChange,
  shouldFilter = true,
  fullScreenOnMobile = false,
  onCloseAutoFocus,
}: CommandPaletteProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const [pages, setPages] = useState<readonly PageEntry[]>([{ id: ROOT_PAGE }]);
  const [uncontrolledSearch, setUncontrolledSearch] = useState("");
  const search = searchProp ?? uncontrolledSearch;
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;
  const setSearch = useCallback((next: string) => {
    setUncontrolledSearch(next);
    onSearchChangeRef.current?.(next);
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = pages[pages.length - 1] ?? { id: ROOT_PAGE };
  const nested = pages.length > 1;

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange]
  );

  // Start from the root page every time the palette opens.
  useEffect(() => {
    if (!open) {
      setPages([{ id: ROOT_PAGE }]);
      setSearch("");
    }
  }, [open, setSearch]);

  const api = useMemo<CommandPagesApi>(
    () => ({
      page: current.id,
      push: (id, options) => {
        setPages((stack) => [...stack, { id, ...options }]);
        setSearch("");
      },
      pop: () => {
        setPages((stack) => (stack.length > 1 ? stack.slice(0, -1) : stack));
        setSearch("");
      },
      close: () => setOpen(false),
    }),
    [current.id, setOpen, setSearch]
  );

  // The list remounts per page; keep the caret in the input.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus when the page changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [current.id]);

  // The input element of the open page (the dialog's portal mounts it after the first
  // render, and each page mounts its own).
  const [inputElement, setInputElement] = useState<HTMLInputElement | null>(
    null
  );
  const setInput = useCallback((element: HTMLInputElement | null) => {
    inputRef.current = element;
    setInputElement(element);
  }, []);
  useEffect(
    () => (inputElement ? repairActiveDescendant(inputElement) : undefined),
    [inputElement]
  );

  const [statusSlot, setStatusSlot] = useState<HTMLDivElement | null>(null);

  const crumbs = pages.flatMap((entry) => (entry.title ? [entry.title] : []));

  return (
    <CommandPaletteContext.Provider value={api}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className={backdrop} />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onEscapeKeyDown={(event) => {
              if (nested) {
                event.preventDefault();
                api.pop();
              }
            }}
            onCloseAutoFocus={onCloseAutoFocus}
            className={cn(
              "fixed top-[14vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-160 -translate-x-1/2",
              "overflow-hidden rounded-xl border border-line bg-overlay text-fg shadow-overlay outline-none",
              "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
              fullScreenOnMobile &&
                "max-sm:inset-0 max-sm:flex max-sm:h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:flex-col max-sm:rounded-none max-sm:border-0",
              className
            )}
          >
            <VisuallyHidden.Root>
              <DialogPrimitive.Title>{label}</DialogPrimitive.Title>
            </VisuallyHidden.Root>
            <CommandPrimitive
              key={current.id}
              label={label}
              loop
              shouldFilter={shouldFilter}
              className={cn(
                fullScreenOnMobile &&
                  "max-sm:flex max-sm:min-h-0 max-sm:flex-1 max-sm:flex-col"
              )}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && search === "" && nested) {
                  event.preventDefault();
                  api.pop();
                }
              }}
            >
              {context || crumbs.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1 px-4 pt-3 text-xs text-fg-muted">
                  {context ? <PaletteChip>{context}</PaletteChip> : null}
                  {crumbs.map((crumb, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: crumbs are a stack
                      key={index}
                      className="flex items-center gap-1"
                    >
                      {context || index > 0 ? (
                        <ChevronRight className="size-3 text-fg-subtle" />
                      ) : null}
                      <PaletteChip>{crumb}</PaletteChip>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center border-b border-line">
                <CommandPrimitive.Input
                  ref={setInput}
                  value={search}
                  onValueChange={setSearch}
                  placeholder={current.placeholder ?? placeholder}
                  className="h-12 w-full min-w-0 flex-1 bg-transparent px-4 text-base text-fg outline-none placeholder:text-fg-subtle"
                />
                {fullScreenOnMobile ? (
                  <DialogPrimitive.Close
                    className={cn(
                      "mr-2 h-8 shrink-0 rounded-md px-2.5 text-sm text-fg-muted hover:bg-hover hover:text-fg sm:hidden",
                      focusRing
                    )}
                  >
                    Cancel
                  </DialogPrimitive.Close>
                ) : null}
              </div>
              <StatusSlotContext.Provider value={statusSlot}>
                <CommandList
                  className={cn(
                    "h-[min(var(--cmdk-list-height),min(24rem,calc(100dvh-16rem)))] scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5 transition-[height] duration-100",
                    fullScreenOnMobile &&
                      "max-sm:h-auto max-sm:min-h-0 max-sm:flex-1"
                  )}
                >
                  {children}
                </CommandList>
                <ResultCount />
              </StatusSlotContext.Provider>
              <div ref={setStatusSlot} role="status" />
              {footer === false ? null : (
                <div
                  className={cn(
                    "flex h-9 items-center gap-4 border-t border-line px-3 text-2xs text-fg-subtle",
                    fullScreenOnMobile && "max-sm:hidden"
                  )}
                >
                  {footer ?? (
                    <>
                      <KeyHint keys={["↑", "↓"]}>Navigate</KeyHint>
                      <KeyHint keys={["↵"]}>Select</KeyHint>
                      {nested ? <KeyHint keys={["⌫"]}>Back</KeyHint> : null}
                      <KeyHint keys={["esc"]} className="ml-auto">
                        {nested ? "Back" : "Close"}
                      </KeyHint>
                    </>
                  )}
                </div>
              )}
            </CommandPrimitive>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </CommandPaletteContext.Provider>
  );
}

/**
 * Keeps `aria-activedescendant` (on the input and the listbox) pointing at the selected option. cmdk 1.1
 * computes it before the new selection renders, so when typing replaces the selected
 * option it can name the previous option, or one that no longer exists (axe
 * aria-valid-attr-value; screen readers announce the wrong option or nothing). Watches
 * the palette and points it at the option marked `aria-selected`, or drops it when none
 * is.
 */
function repairActiveDescendant(input: HTMLInputElement): () => void {
  const root = input.closest("[cmdk-root]") ?? input.parentElement;
  if (!root) return () => {};
  const repair = () => {
    const selected = root.querySelector<HTMLElement>(
      '[cmdk-item][aria-selected="true"]'
    );
    // cmdk sets it on the input (the combobox) and the listbox.
    const owners = [input, root.querySelector<HTMLElement>("[cmdk-list]")];
    for (const owner of owners) {
      if (!owner) continue;
      const current = owner.getAttribute("aria-activedescendant");
      if (selected?.id) {
        if (current !== selected.id) {
          owner.setAttribute("aria-activedescendant", selected.id);
        }
      } else if (current !== null) {
        owner.removeAttribute("aria-activedescendant");
      }
    }
  };
  const observer = new MutationObserver(repair);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["aria-selected", "aria-activedescendant"],
  });
  repair();
  return () => observer.disconnect();
}

/**
 * How many options match, for screen readers, in the palette's status region (the visible
 * list says it already). Silent before anything is typed and when nothing matches
 * (CommandEmpty speaks then).
 */
function ResultCount() {
  const count = useCommandState((state) =>
    state.search === "" ? 0 : state.filtered.count
  );
  if (count === 0) return null;
  return (
    <StatusSlot>
      <span className="sr-only">
        {count === 1 ? "1 result" : `${count} results`}
      </span>
    </StatusSlot>
  );
}

function PaletteChip({ children }: { readonly children: ReactNode }) {
  return (
    <span className="inline-flex h-5 max-w-60 items-center gap-1 truncate rounded-sm bg-hover px-1.5 font-medium text-fg-muted">
      {children}
    </span>
  );
}

/** A key with what it does, for palette footers. */
export function KeyHint({
  keys,
  children,
  className,
}: {
  readonly keys: readonly string[];
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex gap-0.5">
        {keys.map((key) => (
          <Kbd key={key} className="h-4 min-w-4 px-0.5 text-2xs">
            {key}
          </Kbd>
        ))}
      </span>
      {children}
    </span>
  );
}

export interface CommandPageProps {
  /** Page id; the root page is "root" (the default). */
  readonly id?: string;
  readonly children: ReactNode;
}

/** Content of one palette page; only the current page renders. */
export function CommandPage({ id = ROOT_PAGE, children }: CommandPageProps) {
  const { page } = useCommandPages();
  return page === id ? children : null;
}

export function CommandGroup({
  className,
  ...props
}: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5",
        "[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle",
        "[&+&]:mt-1",
        className
      )}
      {...props}
    />
  );
}

export interface CommandItemProps
  extends ComponentProps<typeof CommandPrimitive.Item> {
  /** Icon before the label. */
  readonly icon?: ReactNode;
  /** Shortcut that runs the same command outside the palette. */
  readonly shortcut?: readonly string[];
  /** Muted text at the end (a type, the current value, "Jump to"). */
  readonly hint?: ReactNode;
}

export function CommandItem({
  className,
  icon,
  shortcut,
  hint,
  children,
  ...props
}: CommandItemProps) {
  return (
    <CommandPrimitive.Item
      className={cn(menuItem, "h-10 gap-3 px-2.5", className)}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? (
        <span className="shrink-0 text-xs text-fg-subtle">{hint}</span>
      ) : null}
      {shortcut ? <Shortcut keys={shortcut} className="shrink-0" /> : null}
    </CommandPrimitive.Item>
  );
}

/** A line between groups; hidden while the user searches unless `alwaysRender`. */
export function CommandSeparator({
  className,
  ...props
}: CommandListSeparatorProps) {
  return (
    <CommandListSeparator
      className={cn("-mx-1.5 my-1.5", className)}
      {...props}
    />
  );
}

/** Shown when the search matches nothing. */
export function CommandEmpty({
  className,
  children = "No results",
  ...props
}: ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <StatusSlot>
      <CommandPrimitive.Empty
        className={cn("py-10 text-center text-sm text-fg-muted", className)}
        {...props}
      >
        {children}
      </CommandPrimitive.Empty>
    </StatusSlot>
  );
}

/** Render while async results load; announced through the palette's status region. */
export function CommandLoading({
  children = "Searching…",
  className,
}: {
  readonly children?: ReactNode;
  readonly className?: string;
}) {
  return (
    <StatusSlot>
      <div
        className={cn(
          "flex items-center justify-center gap-2 py-6 text-sm text-fg-muted",
          className
        )}
      >
        <Spinner />
        {children}
      </div>
    </StatusSlot>
  );
}

/**
 * Render when an async search failed: a message safe to show and, with `onRetry`, a way
 * to try again. Announced through the palette's status region, outside the listbox.
 */
export function CommandError({
  children = "Search failed",
  onRetry,
  className,
}: {
  readonly children?: ReactNode;
  readonly onRetry?: () => void;
  readonly className?: string;
}) {
  return (
    <StatusSlot>
      <div
        className={cn(
          "flex flex-wrap items-center justify-center gap-2 px-4 py-6 text-center text-sm text-fg-muted",
          className
        )}
      >
        <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden />
        <span>{children}</span>
        {onRetry ? (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    </StatusSlot>
  );
}

/** A quiet line under the list, e.g. "No notes match" while other groups still match. */
export function CommandNote({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <StatusSlot>
      <div className={cn("px-4 py-2 text-xs text-fg-muted", className)}>
        {children}
      </div>
    </StatusSlot>
  );
}

export interface CommandPaletteTriggerProps
  extends Omit<ComponentProps<"button">, "children"> {
  /** Visible text; screen-reader only below the `sm` breakpoint, where an icon remains. */
  readonly label?: string;
  /**
   * The shortcut that opens the palette, e.g. `["⌘", "K"]`. Shown only on devices with a
   * fine pointer (a mouse or trackpad, so most likely a keyboard), never on touch screens.
   */
  readonly shortcut?: readonly string[];
}

/**
 * The visible way into the palette, for the app's top bar: a search field look-alike on
 * desktop, a search icon button on phones. Pass `onClick` to open the palette and a `ref`
 * so focus can return to it when the palette closes.
 */
export function CommandPaletteTrigger({
  label = "Search",
  shortcut,
  className,
  ...props
}: CommandPaletteTriggerProps) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md border border-line bg-input px-2.5 text-sm text-fg-muted",
        "hover:bg-hover hover:text-fg sm:min-w-48",
        "max-sm:w-8 max-sm:justify-center max-sm:px-0",
        focusRing,
        className
      )}
      {...props}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="truncate max-sm:sr-only">{label}</span>
      {shortcut ? (
        // Seen, not read: assistive tech gets the shortcut from `aria-keyshortcuts`.
        <span
          aria-hidden
          className="ml-auto hidden shrink-0 pointer-fine:sm:inline-flex"
        >
          <Shortcut keys={shortcut} />
        </span>
      ) : null}
    </button>
  );
}
