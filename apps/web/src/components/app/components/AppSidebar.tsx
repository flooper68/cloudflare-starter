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
import {
  BookOpen,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Trash2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { authClient } from "@/lib/auth-client";

const demos = [
  { to: "/app/upload-demo", label: "Upload", icon: <Upload /> },
  { to: "/app/queue-demo", label: "Queue", icon: <ListTodo /> },
  { to: "/app/email-demo", label: "Email", icon: <Mail /> },
] as const;

async function signOut() {
  await authClient.signOut();
  window.location.href = "/";
}

/**
 * The app's navigation: workspace menu (switch and create in multi mode), pages, demos,
 * and the signed-in user. "Members" shows in modes with shared workspaces; "Trash" is the
 * active workspace's deleted files.
 */
export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mode, list, active, switchTo, create } = useWorkspace();
  const multi = mode === "multi";

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
            onSelect={() => void navigate({ to: "/app/profile" })}
          >
            Profile
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
        <SidebarSection>
          <SidebarItem
            asChild
            icon={<LayoutDashboard />}
            active={pathname === "/app/dashboard"}
          >
            <Link to="/app/dashboard">Dashboard</Link>
          </SidebarItem>
          {mode !== "personal" && active?.kind === "shared" ? (
            <SidebarItem
              asChild
              icon={<Users />}
              active={pathname === "/app/members"}
            >
              <Link to="/app/members">Members</Link>
            </SidebarItem>
          ) : null}
          <SidebarItem
            asChild
            icon={<Trash2 />}
            active={pathname === "/app/trash"}
          >
            <Link to="/app/trash">Trash</Link>
          </SidebarItem>
          <SidebarItem
            asChild
            icon={<UserRound />}
            active={pathname === "/app/profile"}
          >
            <Link to="/app/profile">Profile</Link>
          </SidebarItem>
        </SidebarSection>
        <SidebarSection label="Demos" collapsible>
          {demos.map((demo) => (
            <SidebarItem
              key={demo.to}
              asChild
              icon={demo.icon}
              active={pathname === demo.to}
            >
              <Link to={demo.to}>{demo.label}</Link>
            </SidebarItem>
          ))}
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
