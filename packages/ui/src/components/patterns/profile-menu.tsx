import { ChevronsUpDown } from "lucide-react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import type { MouseEvent, ReactNode } from "react";

import { focusRing, overlayContent } from "../../lib/styles";
import { cn } from "../../lib/utils";
import { Avatar } from "../avatar";
import { Tooltip } from "../tooltip";
import { useAppShell } from "./app-shell";

export interface ProfileMenuProps {
  /** The signed-in person (the impersonated one while an admin impersonates). */
  readonly name: string;
  readonly email: string;
  /** Avatar image URL; initials otherwise. */
  readonly image?: string;
  /**
   * The menu after the name and email: SidebarMenuItem (with `asChild` for links),
   * SidebarMenuSeparator, SidebarMenuLabel. Sign out goes last.
   */
  readonly children: ReactNode;
  /** Opens at first render (stories and docs). */
  readonly defaultOpen?: boolean;
}

/**
 * The account menu in the sidebar footer: the avatar and name open a menu, upward, headed
 * by the person's name and email, with their own pages (profile, security, appearance),
 * help links and Sign out. Collapsed, the trigger is the avatar alone with the name in a
 * tooltip; in the mobile drawer, picking an item closes the drawer. Workspace items belong
 * in `WorkspaceSwitcher`, not here. Lives inside `AppShell`, in `SidebarFooter`.
 */
export function ProfileMenu({
  name,
  email,
  image,
  children,
  defaultOpen,
}: ProfileMenuProps) {
  const { collapsed, isMobile, setMobileOpen } = useAppShell();
  const display = name.trim() || email;

  const trigger = (
    <DropdownMenuPrimitive.Trigger
      className={cn(
        "flex h-9 min-w-0 items-center gap-2 rounded-md text-left text-sm text-fg-muted hover:bg-hover hover:text-fg data-[state=open]:bg-hover data-[state=open]:text-fg",
        collapsed ? "w-9 justify-center" : "w-full px-1.5",
        focusRing
      )}
    >
      <Avatar name={display} src={image} size="sm" aria-hidden />
      {/* The name is "<name> profile menu", its visible text first (WCAG 2.5.3). */}
      {collapsed ? (
        <span className="sr-only">{display} profile menu</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">
            {display}
            <span className="sr-only"> profile menu</span>
          </span>
          <ChevronsUpDown
            aria-hidden
            className="size-3.5 shrink-0 text-fg-subtle"
          />
        </>
      )}
    </DropdownMenuPrimitive.Trigger>
  );

  /** In the drawer, a picked item (a page, sign out) also closes the drawer. */
  function closeDrawer(event: MouseEvent<HTMLDivElement>) {
    if (!isMobile) return;
    if ((event.target as Element).closest('[role="menuitem"]')) {
      setMobileOpen(false);
    }
  }

  return (
    <DropdownMenuPrimitive.Root defaultOpen={defaultOpen}>
      {collapsed ? (
        <Tooltip content={display} side="right">
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          sideOffset={6}
          collisionPadding={8}
          onClick={closeDrawer}
          className={cn(overlayContent, "w-64 max-w-[calc(100vw-1rem)] p-1")}
        >
          <DropdownMenuPrimitive.Label className="flex min-w-0 items-center gap-2 px-2 pt-2 pb-2">
            <Avatar name={display} src={image} size="md" aria-hidden />
            <span className="flex min-w-0 flex-col">
              <span
                title={display}
                className="truncate text-sm font-medium text-fg"
              >
                {display}
              </span>
              {name.trim() ? (
                <span title={email} className="truncate text-xs text-fg-muted">
                  {email}
                </span>
              ) : null}
            </span>
          </DropdownMenuPrimitive.Label>
          <DropdownMenuPrimitive.Separator className="-mx-1 my-1 h-px bg-line" />
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
