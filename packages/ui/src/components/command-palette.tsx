import { Command as CommandPrimitive } from "cmdk";
import { ChevronRight } from "lucide-react";
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
import { backdrop, menuItem } from "../lib/styles";
import { cn } from "../lib/utils";
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
}: CommandPaletteProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const [pages, setPages] = useState<readonly PageEntry[]>([{ id: ROOT_PAGE }]);
  const [search, setSearch] = useState("");
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
  }, [open]);

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
    [current.id, setOpen]
  );

  // The list remounts per page; keep the caret in the input.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus when the page changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [current.id]);

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
            className={cn(
              "fixed top-[14vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-160 -translate-x-1/2",
              "overflow-hidden rounded-xl border border-line bg-overlay text-fg shadow-overlay outline-none",
              "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
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
              <CommandPrimitive.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                placeholder={current.placeholder ?? placeholder}
                className="h-12 w-full border-b border-line bg-transparent px-4 text-base text-fg outline-none placeholder:text-fg-subtle"
              />
              <StatusSlotContext.Provider value={statusSlot}>
                <CommandList className="h-[min(var(--cmdk-list-height),min(24rem,calc(100dvh-16rem)))] scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5 transition-[height] duration-100">
                  {children}
                </CommandList>
              </StatusSlotContext.Provider>
              <div ref={setStatusSlot} role="status" />
              {footer === false ? null : (
                <div className="flex h-9 items-center gap-4 border-t border-line px-3 text-2xs text-fg-subtle">
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
