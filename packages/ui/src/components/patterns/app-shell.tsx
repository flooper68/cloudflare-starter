import { ChevronDown, ChevronRight, PanelLeft } from "lucide-react";
import {
  Collapsible as CollapsiblePrimitive,
  Dialog as DialogPrimitive,
  DropdownMenu as DropdownMenuPrimitive,
  Slot,
  ToggleGroup as ToggleGroupPrimitive,
} from "radix-ui";
import {
  type ButtonHTMLAttributes,
  cloneElement,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { brand, LogoMark } from "../../brand/brand";
import {
  backdrop,
  focusRing,
  menuItem,
  overlayContent,
} from "../../lib/styles";
import { cn } from "../../lib/utils";
import { IconButton } from "../button";
import { Tooltip, TooltipProvider } from "../tooltip";
import { isTypingTarget, useControllable } from "./internal";

/* ------------------------------------------------------------------------------------------ */
/* Context                                                                                     */
/* ------------------------------------------------------------------------------------------ */

interface AppShellContextValue {
  /** The sidebar shows icons only. Always false inside the mobile drawer. */
  readonly collapsed: boolean;
  readonly setCollapsed: (collapsed: boolean) => void;
  /** Narrow viewport: the sidebar is an overlay drawer. */
  readonly isMobile: boolean;
  readonly mobileOpen: boolean;
  readonly setMobileOpen: (open: boolean) => void;
  /** Collapses on desktop, opens/closes the drawer on mobile. */
  readonly toggleSidebar: () => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

/** Sidebar state from the nearest AppShell. */
export function useAppShell(): AppShellContextValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell must be used inside <AppShell>.");
  return ctx;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/* ------------------------------------------------------------------------------------------ */
/* AppShell                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export interface AppShellProps {
  /** Usually a <Sidebar>. */
  readonly sidebar: ReactNode;
  /** The main area: an AppTopBar and the page. */
  readonly children: ReactNode;
  readonly collapsed?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
  /** Key that toggles the sidebar; null turns the shortcut off. */
  readonly toggleKey?: string | null;
  /** Below this width (px) the sidebar becomes a drawer. */
  readonly mobileBreakpoint?: number;
  readonly className?: string;
}

/**
 * Linear's app frame: a left sidebar (collapsible to icons, `[` toggles) and an inset main
 * panel. Below `mobileBreakpoint` the sidebar turns into an overlay drawer opened from the
 * top bar's SidebarTrigger.
 */
export function AppShell({
  sidebar,
  children,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  toggleKey = "[",
  mobileBreakpoint = 768,
  className,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useControllable(
    collapsedProp,
    defaultCollapsed,
    onCollapsedChange
  );
  const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint - 1}px)`);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  const value = useMemo<AppShellContextValue>(
    () => ({
      collapsed: isMobile ? false : collapsed,
      setCollapsed,
      isMobile,
      mobileOpen,
      setMobileOpen,
      toggleSidebar: () =>
        isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed),
    }),
    [collapsed, setCollapsed, isMobile, mobileOpen]
  );

  useEffect(() => {
    if (!toggleKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== toggleKey || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      value.toggleSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleKey, value]);

  return (
    <AppShellContext.Provider value={value}>
      <TooltipProvider>
        <div
          className={cn(
            "flex h-dvh min-h-0 w-full overflow-hidden bg-canvas text-fg",
            className
          )}
        >
          {isMobile ? (
            <DialogPrimitive.Root
              open={mobileOpen}
              onOpenChange={setMobileOpen}
            >
              <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className={backdrop} />
                <DialogPrimitive.Content
                  aria-describedby={undefined}
                  className={cn(
                    "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-canvas shadow-overlay outline-none",
                    "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out"
                  )}
                >
                  <DialogPrimitive.Title className="sr-only">
                    Navigation
                  </DialogPrimitive.Title>
                  {sidebar}
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          ) : (
            <aside
              data-collapsed={collapsed || undefined}
              className={cn(
                "flex shrink-0 flex-col transition-[width] duration-150 ease-out",
                collapsed ? "w-13" : "w-60"
              )}
            >
              {sidebar}
            </aside>
          )}
          <main
            className={cn(
              "flex min-w-0 flex-1 flex-col overflow-hidden bg-surface",
              !isMobile &&
                "my-2 mr-2 rounded-lg border border-line shadow-raised"
            )}
          >
            {children}
          </main>
        </div>
      </TooltipProvider>
    </AppShellContext.Provider>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Sidebar                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** The sidebar's column: header, scrolling content and footer. */
export function Sidebar({
  children,
  className,
  "aria-label": ariaLabel = "Main",
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly "aria-label"?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex h-full min-h-0 flex-col py-2", className)}
    >
      {children}
    </nav>
  );
}

export function SidebarHeader({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const { collapsed } = useAppShell();
  return (
    <div
      className={cn(
        "flex shrink-0 gap-1 px-2 pb-2",
        collapsed ? "flex-col items-center" : "flex-col",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Scrolling middle of the sidebar. */
export function SidebarContent({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const { collapsed } = useAppShell();
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-1",
        collapsed && "items-center",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SidebarFooter({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const { collapsed } = useAppShell();
  return (
    <div
      className={cn(
        "flex shrink-0 gap-1 px-2 pt-2",
        collapsed ? "flex-col items-center" : "items-center",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface SidebarWorkspaceSwitcherProps {
  readonly name?: string;
  readonly logo?: ReactNode;
  /** Menu content: SidebarMenuItem, SidebarMenuSeparator, SidebarMenuLabel. */
  readonly children?: ReactNode;
  /** Buttons on the right of the switcher (search, new issue); stacked when collapsed. */
  readonly actions?: ReactNode;
  /**
   * Called when the menu closes, before focus returns to the trigger; `preventDefault()`
   * keeps focus where a menu item put it (a dialog it opened).
   */
  readonly onCloseAutoFocus?: (event: Event) => void;
}

/** Workspace logo and name; opens a menu of workspaces and account actions. */
export function SidebarWorkspaceSwitcher({
  name = brand.name,
  logo = <LogoMark className="size-5" />,
  children,
  actions,
  onCloseAutoFocus,
}: SidebarWorkspaceSwitcherProps) {
  const { collapsed } = useAppShell();
  const trigger = (
    <DropdownMenuPrimitive.Trigger
      aria-label={`${name} workspace menu`}
      className={cn(
        "flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-sm font-semibold text-fg hover:bg-hover data-[state=open]:bg-hover",
        collapsed ? "justify-center" : "flex-1",
        focusRing
      )}
    >
      <span className="flex shrink-0 [&_svg]:size-5">{logo}</span>
      {collapsed ? null : (
        <>
          <span className="truncate">{name}</span>
          <ChevronDown className="size-3.5 shrink-0 text-fg-subtle" />
        </>
      )}
    </DropdownMenuPrimitive.Trigger>
  );

  return (
    <div
      className={cn("flex w-full items-center gap-1", collapsed && "flex-col")}
    >
      <DropdownMenuPrimitive.Root>
        {collapsed ? (
          <Tooltip content={name} side="right">
            {trigger}
          </Tooltip>
        ) : (
          trigger
        )}
        {children ? (
          <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
              align="start"
              onCloseAutoFocus={onCloseAutoFocus}
              sideOffset={6}
              className={cn(overlayContent, "min-w-56 p-1")}
            >
              {children}
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        ) : null}
      </DropdownMenuPrimitive.Root>
      {actions ? (
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5",
            collapsed && "flex-col"
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarMenuItem({
  icon,
  shortcut,
  children,
  onSelect,
}: {
  readonly icon?: ReactNode;
  readonly shortcut?: ReactNode;
  readonly children: ReactNode;
  readonly onSelect?: () => void;
}) {
  return (
    <DropdownMenuPrimitive.Item className={menuItem} onSelect={onSelect}>
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut}
    </DropdownMenuPrimitive.Item>
  );
}

export function SidebarMenuSeparator() {
  return (
    <DropdownMenuPrimitive.Separator className="-mx-1 my-1 h-px bg-line" />
  );
}

export function SidebarMenuLabel({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <DropdownMenuPrimitive.Label className="px-2 pt-2 pb-1 text-xs font-medium text-fg-subtle">
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

export interface SidebarSectionProps {
  /** Section heading, e.g. "Your teams". Hidden when the sidebar is collapsed. */
  readonly label?: ReactNode;
  /** Heading toggles the section. */
  readonly collapsible?: boolean;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

export function SidebarSection({
  label,
  collapsible = false,
  defaultOpen = true,
  children,
}: SidebarSectionProps) {
  const { collapsed } = useAppShell();
  const [open, setOpen] = useState(defaultOpen);
  const list = (
    <ul className={cn("flex flex-col gap-px", collapsed && "items-center")}>
      {children}
    </ul>
  );

  if (collapsed || !label) {
    return <div className="flex w-full flex-col">{list}</div>;
  }

  if (!collapsible) {
    return (
      <div className="flex flex-col">
        <div className="px-2 pb-1 text-xs font-medium text-fg-subtle">
          {label}
        </div>
        {list}
      </div>
    );
  }

  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen}>
      <CollapsiblePrimitive.Trigger
        className={cn(
          "group/section flex h-6 w-full items-center gap-1 rounded-md px-2 text-xs font-medium text-fg-subtle hover:text-fg-muted",
          focusRing
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className="size-3 transition-transform duration-100 group-data-[state=closed]/section:-rotate-90"
        />
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content>{list}</CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}

export interface SidebarItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  readonly icon: ReactNode;
  readonly children: ReactNode;
  readonly active?: boolean;
  /** Unread count or similar, right-aligned. */
  readonly count?: number;
  /** Indented sub-item (inside a SidebarTeam). */
  readonly inset?: boolean;
  /** Shortcut shown in the collapsed tooltip. */
  readonly shortcut?: readonly string[];
  /** Render the child (a router Link) with the item's styles. */
  readonly asChild?: boolean;
}

/** One navigation row. Collapsed: icon only, label and count in a tooltip. */
export function SidebarItem({
  icon,
  children,
  active = false,
  count,
  inset = false,
  shortcut,
  asChild = false,
  className,
  onClick,
  ...props
}: SidebarItemProps) {
  const { collapsed, isMobile, setMobileOpen } = useAppShell();
  const Comp = asChild ? Slot.Root : "button";
  // With asChild (e.g. a router link) the child keeps its element but gets the same
  // icon / label / count layout, its own children becoming the label.
  const label =
    asChild && isValidElement<{ children?: ReactNode }>(children)
      ? children.props.children
      : children;
  const inner = (text: ReactNode) => (
    <>
      <span className="flex shrink-0">{icon}</span>
      {collapsed ? (
        <>
          <span className="sr-only">{text}</span>
          {count ? (
            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" />
          ) : null}
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{text}</span>
          {count ? (
            <span className="text-xs tabular-nums text-fg-subtle">{count}</span>
          ) : null}
        </>
      )}
    </>
  );

  const content = (
    <Comp
      type={asChild ? undefined : "button"}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (isMobile) setMobileOpen(false);
      }}
      className={cn(
        "relative flex h-7 items-center gap-2 rounded-md text-sm text-fg-muted transition-colors",
        "hover:bg-hover hover:text-fg data-[active]:bg-active data-[active]:text-fg",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        collapsed ? "w-8 justify-center" : "w-full px-2",
        inset && !collapsed && "pl-7",
        focusRing,
        className
      )}
      {...props}
    >
      {asChild && isValidElement<{ children?: ReactNode }>(children)
        ? cloneElement(children, undefined, inner(label))
        : inner(label)}
    </Comp>
  );

  return (
    <li className="flex">
      {collapsed ? (
        <Tooltip
          side="right"
          shortcut={shortcut}
          content={
            <span className="flex items-center gap-1.5">
              {label}
              {count ? (
                <span className="text-fg-subtle tabular-nums">{count}</span>
              ) : null}
            </span>
          }
        >
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </li>
  );
}

/** A team's coloured initial, for SidebarTeam and pickers. */
export function TeamIcon({
  name,
  tone = "accent",
  className,
}: {
  readonly name: string;
  readonly tone?: "accent" | "success" | "warning" | "danger" | "info";
  readonly className?: string;
}) {
  const tones = {
    accent: "bg-accent-subtle text-accent-text",
    success: "bg-success-subtle text-success",
    warning: "bg-warning-subtle text-warning",
    danger: "bg-danger-subtle text-danger",
    info: "bg-info-subtle text-info",
  } as const;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold",
        tones[tone],
        className
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export interface SidebarTeamProps {
  readonly name: string;
  readonly icon?: ReactNode;
  readonly defaultOpen?: boolean;
  /** SidebarItem inset rows: Issues, Projects, Views… */
  readonly children: ReactNode;
}

/** A team with its own pages, collapsible. Collapsed sidebar: the team icon only. */
export function SidebarTeam({
  name,
  icon,
  defaultOpen = true,
  children,
}: SidebarTeamProps) {
  const { collapsed } = useAppShell();
  const [open, setOpen] = useState(defaultOpen);
  const teamIcon = icon ?? <TeamIcon name={name} />;

  if (collapsed) {
    return (
      <li className="flex">
        <Tooltip content={name} side="right">
          <button
            type="button"
            aria-label={name}
            className={cn(
              "flex size-8 items-center justify-center rounded-md hover:bg-hover",
              focusRing
            )}
          >
            {teamIcon}
          </button>
        </Tooltip>
      </li>
    );
  }

  return (
    <li>
      <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen}>
        <CollapsiblePrimitive.Trigger
          className={cn(
            "group/team flex h-7 w-full items-center gap-2 rounded-md px-2 text-sm text-fg-muted hover:bg-hover hover:text-fg",
            focusRing
          )}
        >
          {teamIcon}
          <span className="min-w-0 truncate">{name}</span>
          <ChevronRight
            aria-hidden="true"
            className="size-3 shrink-0 text-fg-subtle transition-transform duration-100 group-data-[state=open]/team:rotate-90"
          />
        </CollapsiblePrimitive.Trigger>
        <CollapsiblePrimitive.Content>
          <ul className="flex flex-col gap-px pt-px">{children}</ul>
        </CollapsiblePrimitive.Content>
      </CollapsiblePrimitive.Root>
    </li>
  );
}

/** Opens the drawer on mobile, collapses the sidebar on desktop. */
export function SidebarTrigger({ className }: { readonly className?: string }) {
  const { toggleSidebar, collapsed, isMobile } = useAppShell();
  const label = isMobile
    ? "Open navigation"
    : collapsed
      ? "Expand sidebar"
      : "Collapse sidebar";
  return (
    <Tooltip content={label} shortcut={["["]}>
      <IconButton
        label={label}
        size="sm"
        onClick={toggleSidebar}
        className={className}
      >
        <PanelLeft />
      </IconButton>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Top bar                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export interface AppTopBarProps {
  /** Left: usually an AppBreadcrumb. */
  readonly title: ReactNode;
  /** Right: view switch, filter and display buttons. */
  readonly actions?: ReactNode;
  /** Show the SidebarTrigger before the title. Defaults to on. */
  readonly showSidebarTrigger?: boolean;
  readonly className?: string;
}

/** The header row of the main panel. */
export function AppTopBar({
  title,
  actions,
  showSidebarTrigger = true,
  className,
}: AppTopBarProps) {
  return (
    <header
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 border-b border-line px-3",
        className
      )}
    >
      {showSidebarTrigger ? <SidebarTrigger /> : null}
      <div className="flex min-w-0 flex-1 items-center">{title}</div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </header>
  );
}

/** "Engineering › Active issues": the last item is the current page. */
export function AppBreadcrumb({
  items,
}: {
  readonly items: readonly ReactNode[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: breadcrumb positions are stable.
            <li key={index} className="flex min-w-0 items-center gap-1">
              <span
                aria-current={last ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 truncate [&_svg]:size-4",
                  last ? "font-medium text-fg" : "text-fg-muted"
                )}
              >
                {item}
              </span>
              {last ? null : (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-fg-subtle"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface ViewSwitchOption {
  readonly value: string;
  readonly label: string;
  readonly icon: ReactNode;
}

export interface ViewSwitchProps {
  readonly options: readonly ViewSwitchOption[];
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  /** Show labels next to icons. */
  readonly showLabels?: boolean;
  readonly className?: string;
}

/** Segmented icon switch for the top bar (List / Board). */
export function ViewSwitch({
  options,
  value,
  defaultValue,
  onValueChange,
  showLabels = false,
  className,
}: ViewSwitchProps) {
  const [current, setCurrent] = useControllable(
    value,
    defaultValue ?? options[0]?.value ?? "",
    onValueChange
  );
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={current}
      onValueChange={(next) => next && setCurrent(next)}
      aria-label="View"
      className={cn(
        "inline-flex h-7 items-center gap-0.5 rounded-md border border-line bg-surface-raised p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const item = (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            aria-label={option.label}
            className={cn(
              "inline-flex h-full items-center gap-1.5 rounded-sm px-1.5 text-xs text-fg-muted transition-colors",
              "hover:text-fg data-[state=on]:bg-active data-[state=on]:text-fg",
              "[&_svg]:size-3.5",
              focusRing
            )}
          >
            {option.icon}
            {showLabels ? option.label : null}
          </ToggleGroupPrimitive.Item>
        );
        return showLabels ? (
          <span key={option.value} className="contents">
            {item}
          </span>
        ) : (
          <Tooltip key={option.value} content={option.label}>
            {item}
          </Tooltip>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}
