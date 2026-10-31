import { createRoute, redirect } from "@tanstack/react-router";

import { rootRoute } from "@/components/app/root-route";
import { AdminLayout } from "./AdminLayout";
import { AdminAuditPage } from "./pages/AdminAuditPage";
import { AdminFlagsPage } from "./pages/AdminFlagsPage";
import { AdminOverviewPage } from "./pages/AdminOverviewPage";
import { AdminPrivacyPage } from "./pages/AdminPrivacyPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminUserPage } from "./pages/AdminUserPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AdminWorkspacePage } from "./pages/AdminWorkspacePage";
import { AdminWorkspacesPage } from "./pages/AdminWorkspacesPage";

/**
 * The admin portal's layout route. The server only serves `/admin/*` to admins
 * (pages/admin/[...path].astro) and every `admin.*` procedure checks again.
 */
export const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "admin-layout",
  component: AdminLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin",
  beforeLoad: () => {
    throw redirect({ to: "/admin/overview" });
  },
});

const overviewRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/overview",
  component: AdminOverviewPage,
});

const usersRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/users",
  component: AdminUsersPage,
});

const userRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/users/$userId",
  component: AdminUserPage,
});

const workspacesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/workspaces",
  component: AdminWorkspacesPage,
});

const workspaceRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/workspaces/$workspaceId",
  component: AdminWorkspacePage,
});

const auditRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/audit",
  component: AdminAuditPage,
});

const flagsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/flags",
  component: AdminFlagsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/settings",
  component: AdminSettingsPage,
});

/**
 * The admin portal's pages. A project adds one by appending a route here (parent
 * `adminLayoutRoute`) and an entry to `adminNav` (admin-nav.tsx); its data comes from an
 * `admin.*` procedure (docs/guides/how-to-use-admin-portal.md).
 */
const privacyRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "/admin/data-requests",
  component: AdminPrivacyPage,
});

export const adminRoutes = [
  privacyRoute,
  indexRoute,
  overviewRoute,
  usersRoute,
  userRoute,
  workspacesRoute,
  workspaceRoute,
  auditRoute,
  flagsRoute,
  settingsRoute,
] as const;
