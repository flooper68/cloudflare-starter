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
  SidebarWorkspaceSwitcher,
} from "@cloudflare-starter/ui";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Upload,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";
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

/** The app's navigation: workspace menu, pages, demos, and the signed-in user. */
export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarWorkspaceSwitcher>
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
        </SidebarWorkspaceSwitcher>
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
