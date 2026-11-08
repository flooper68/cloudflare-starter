import {
  Avatar,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarMenuSeparator,
  SidebarSection,
  toast,
  WorkspaceSwitcher,
} from "@cloudflare-starter/ui";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { BookOpen, LogOut, UserRound } from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";

import { navIcons } from "../nav-icons";
import {
  isActiveDestination,
  type SidebarGroup,
  sidebarDestinations,
} from "../navigation";
import { signOut, useNavContext } from "../use-nav-context";

/**
 * The app's navigation: workspace menu (switch and create in multi mode), pages, demos,
 * and the signed-in user. The entries come from navigation.ts (the source the command
 * palette and the top bar read too): "Members" shows in modes with shared workspaces,
 * "Admin" for platform admins, "Trash" is the active workspace's deleted files and notes.
 */
export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mode, list, active, switchTo, create } = useWorkspace();
  const navContext = useNavContext();
  const multi = mode === "multi";

  /** One sidebar section's entries, from the app's navigation source (navigation.ts). */
  const items = (section: SidebarGroup) =>
    sidebarDestinations(navContext, section).map((destination) => (
      <SidebarItem
        key={destination.id}
        asChild
        icon={navIcons[destination.icon]}
        active={
          destination.document
            ? undefined
            : isActiveDestination(destination, pathname)
        }
      >
        {destination.document ? (
          // A full load: the server checks access (the admin portal) before serving it.
          <a href={destination.to}>{destination.label}</a>
        ) : (
          <Link to={destination.to}>{destination.label}</Link>
        )}
      </SidebarItem>
    ));

  async function onSwitch(workspaceId: string) {
    try {
      await switchTo(workspaceId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Switch failed");
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <WorkspaceSwitcher
          workspaces={list.data?.items ?? []}
          activeId={active?.id ?? ""}
          onSwitch={multi ? (id) => void onSwitch(id) : undefined}
          onCreate={multi ? create : undefined}
        >
          <SidebarMenuLabel>{user?.email}</SidebarMenuLabel>
          <SidebarMenuItem
            icon={<UserRound />}
            onSelect={() => void navigate({ to: "/app/settings/account" })}
          >
            Settings
          </SidebarMenuItem>
          <SidebarMenuItem
            icon={<BookOpen />}
            onSelect={() => window.open("/_storybook/", "_blank")}
          >
            Component library
          </SidebarMenuItem>
          <SidebarMenuSeparator />
          <SidebarMenuItem icon={<LogOut />} onSelect={() => void signOut()}>
            Sign out
          </SidebarMenuItem>
        </WorkspaceSwitcher>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>{items("main")}</SidebarSection>
        {/* Placeholder apps: where a project's own product goes. */}
        <SidebarSection label="Product · placeholder">
          {items("product")}
        </SidebarSection>
        {sidebarDestinations(navContext, "admin").length > 0 ? (
          <SidebarSection>{items("admin")}</SidebarSection>
        ) : null}
        <SidebarSection label="Demos" collapsible>
          {items("demos")}
        </SidebarSection>
      </SidebarContent>
      {user ? (
        <SidebarFooter>
          <div className="flex min-w-0 items-center gap-2 px-1.5 py-1">
            <Avatar
              name={user.name || user.email}
              src={user.image ?? undefined}
              size="sm"
            />
            <span className="truncate text-sm text-fg-muted">{user.name}</span>
          </div>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}
