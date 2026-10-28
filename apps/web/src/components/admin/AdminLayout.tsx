import {
  AppShell,
  AppTopBar,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  Toaster,
} from "@cloudflare-starter/ui";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";

import { adminNav } from "./admin-nav";

function AdminSidebar() {
  const { pathname } = useLocation();
  const { user, workspace } = useAuth();
  return (
    <Sidebar>
      <SidebarHeader>
        <span className="flex items-center gap-2 px-1.5 py-1 text-sm font-semibold text-fg">
          <ShieldCheck aria-hidden className="size-4 text-accent" />
          Admin
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          {adminNav
            .filter((item) => !item.workspaces || workspace.mode !== "personal")
            .map((item) => (
              <SidebarItem
                key={item.to}
                asChild
                icon={item.icon}
                active={
                  pathname === item.to || pathname.startsWith(`${item.to}/`)
                }
              >
                <Link to={item.to}>{item.label}</Link>
              </SidebarItem>
            ))}
        </SidebarSection>
        <SidebarSection>
          <SidebarItem asChild icon={<ArrowLeft />}>
            <a href="/app/dashboard">Back to the app</a>
          </SidebarItem>
        </SidebarSection>
      </SidebarContent>
      {user ? (
        <SidebarFooter>
          <span className="truncate px-1.5 py-1 text-sm text-fg-muted">
            {user.email}
          </span>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}

function titleOf(pathname: string): string {
  const item = adminNav.find(
    (entry) => pathname === entry.to || pathname.startsWith(`${entry.to}/`)
  );
  return item ? `Admin · ${item.label}` : "Admin";
}

/** The admin portal's shell: its own sidebar, a top bar, the page, toasts. */
export function AdminLayout() {
  const { pathname } = useLocation();
  return (
    <AppShell sidebar={<AdminSidebar />}>
      <AppTopBar
        title={
          <span className="truncate text-sm font-medium text-fg">
            {titleOf(pathname)}
          </span>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
          <Outlet />
        </div>
      </div>
      <Toaster />
    </AppShell>
  );
}
