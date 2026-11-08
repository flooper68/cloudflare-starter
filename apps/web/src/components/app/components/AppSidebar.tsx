import {
  ProfileMenu,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarMenuItem,
  SidebarMenuSeparator,
  SidebarSection,
  toast,
  WorkspaceSwitcher,
} from "@cloudflare-starter/ui";
import { Link, useLocation } from "@tanstack/react-router";
import { LogOut, UserRoundX } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";

import { navIcons } from "../nav-icons";
import {
  isActiveDestination,
  type MenuEntry,
  profileMenuEntries,
  type SidebarGroup,
  sidebarDestinations,
  workspaceMenuEntries,
} from "../navigation";
import { signOut, stopImpersonating, useNavContext } from "../use-nav-context";

/**
 * One menu link: a router Link for app pages (client-side routing), a plain anchor for
 * another document (the docs, the component library in a new tab, the admin portal, which
 * the server checks before serving it).
 */
function MenuLink({ entry }: { readonly entry: MenuEntry }): ReactNode {
  return (
    <SidebarMenuItem asChild icon={navIcons[entry.icon]}>
      {entry.document ? (
        <a
          href={entry.to}
          target={entry.newTab ? "_blank" : undefined}
          rel={entry.newTab ? "noreferrer" : undefined}
        >
          {entry.label}
        </a>
      ) : (
        <Link to={entry.to}>{entry.label}</Link>
      )}
    </SidebarMenuItem>
  );
}

/** The sections of the profile menu: own pages, help, the admin portal. */
function profileSections(entries: readonly MenuEntry[]): MenuEntry[][] {
  const help = new Set(["component-library", "docs"]);
  return [
    entries.filter((entry) => !help.has(entry.id) && entry.id !== "admin"),
    entries.filter((entry) => help.has(entry.id)),
    entries.filter((entry) => entry.id === "admin"),
  ].filter((section) => section.length > 0);
}

/**
 * The app's navigation: the workspace menu at the top (switch, create, the workspace's
 * settings and members), pages, demos, and the profile menu in the footer (the person's
 * own pages, help, admin portal, sign out). Every entry comes from navigation.ts, the
 * source the command palette and the top bar read too.
 */
export function AppSidebar() {
  const { pathname } = useLocation();
  const { user, impersonatedBy } = useAuth();
  const { mode, list, active, switchTo, create } = useWorkspace();
  const navContext = useNavContext();
  const multi = mode === "multi";
  const workspaceEntries = workspaceMenuEntries(navContext);

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
          {workspaceEntries.length > 0
            ? workspaceEntries.map((entry) => (
                <MenuLink key={entry.id} entry={entry} />
              ))
            : undefined}
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
          <ProfileMenu
            name={user.name}
            email={user.email}
            image={user.image ?? undefined}
          >
            {profileSections(profileMenuEntries(navContext)).map(
              (section, index) => (
                <Fragment key={section[0]?.id ?? index}>
                  {index > 0 ? <SidebarMenuSeparator /> : null}
                  {section.map((entry) => (
                    <MenuLink key={entry.id} entry={entry} />
                  ))}
                </Fragment>
              )
            )}
            <SidebarMenuSeparator />
            {impersonatedBy ? (
              <SidebarMenuItem
                icon={<UserRoundX />}
                onSelect={() => void stopImpersonating(user.id)}
              >
                Stop impersonating
              </SidebarMenuItem>
            ) : null}
            <SidebarMenuItem icon={<LogOut />} onSelect={() => void signOut()}>
              Sign out
            </SidebarMenuItem>
          </ProfileMenu>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}
