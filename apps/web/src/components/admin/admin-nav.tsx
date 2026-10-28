import {
  Building2,
  Flag,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

export interface AdminNavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: ReactNode;
  /** Hidden in personal mode, where workspaces are not administered. */
  readonly workspaces?: boolean;
}

/** The admin sidebar, in order. A new admin page adds its entry here (and its route to adminRoutes). */
export const adminNav: readonly AdminNavItem[] = [
  { to: "/admin/overview", label: "Overview", icon: <LayoutDashboard /> },
  { to: "/admin/users", label: "Users", icon: <Users /> },
  {
    to: "/admin/workspaces",
    label: "Workspaces",
    icon: <Building2 />,
    workspaces: true,
  },
  { to: "/admin/audit", label: "Audit log", icon: <ScrollText /> },
  { to: "/admin/flags", label: "Feature flags", icon: <Flag /> },
  { to: "/admin/settings", label: "Settings", icon: <Settings /> },
];
