import { Tabs as TabsPrimitive } from "radix-ui";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
} from "react";

import { focusRing } from "../lib/styles";
import { cn } from "../lib/utils";

type TabsVariant = "underline" | "pill";
type TabsSize = "sm" | "md";

const TabsStyleContext = createContext<{
  variant: TabsVariant;
  size: TabsSize;
}>({ variant: "underline", size: "md" });

/**
 * Switch between views of the same thing (Issues / Activity / Settings). `underline`
 * for page-level sections, `pill` (segmented) for compact view switches in toolbars.
 * Built on Radix Tabs: arrow keys move between tabs, `value`/`defaultValue`/`onValueChange`.
 */
export function Tabs({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      className={cn(
        "flex flex-col gap-3 data-[orientation=vertical]:flex-row",
        className
      )}
      {...props}
    />
  );
}

export interface TabsListProps
  extends ComponentProps<typeof TabsPrimitive.List> {
  readonly variant?: TabsVariant;
  readonly size?: TabsSize;
}

export function TabsList({
  variant = "underline",
  size = "md",
  className,
  ...props
}: TabsListProps) {
  return (
    <TabsStyleContext.Provider value={{ variant, size }}>
      <TabsPrimitive.List
        className={cn(
          "flex items-center",
          variant === "underline" && "gap-4 border-b border-line",
          variant === "pill" &&
            "w-fit gap-0.5 rounded-lg border border-line bg-surface p-0.5",
          className
        )}
        {...props}
      />
    </TabsStyleContext.Provider>
  );
}

export interface TabsTriggerProps
  extends ComponentProps<typeof TabsPrimitive.Trigger> {
  readonly icon?: ReactNode;
  /** A number after the label (open issues in this view). */
  readonly count?: number;
}

export function TabsTrigger({
  icon,
  count,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const { variant, size } = useContext(TabsStyleContext);

  return (
    <TabsPrimitive.Trigger
      className={cn(
        "group/tab inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium",
        "text-fg-muted transition-colors duration-100 hover:text-fg",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        focusRing,
        variant === "underline" && [
          "relative -mb-px rounded-sm border-b-2 border-transparent",
          size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
          "data-[state=active]:border-fg data-[state=active]:text-fg",
        ],
        variant === "pill" && [
          "rounded-md px-2.5",
          size === "sm" ? "h-6 text-xs" : "h-7 text-sm",
          "hover:bg-hover data-[state=active]:bg-surface-raised data-[state=active]:text-fg data-[state=active]:shadow-raised",
        ],
        className
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-sm px-1 text-2xs leading-4 tabular-nums",
            "bg-hover text-fg-muted group-data-[state=active]/tab:bg-active group-data-[state=active]/tab:text-fg"
          )}
        >
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        "outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-md",
        className
      )}
      {...props}
    />
  );
}
