import { createRoute, createRouter, redirect } from "@tanstack/react-router";

import { adminLayoutRoute, adminRoutes } from "@/components/admin/routes";
import {
  settingsLayoutRoute,
  settingsRoutes,
} from "@/components/settings/routes";
import { appLayoutRoute } from "./layout-route";
import { BillingPage } from "./pages/BillingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmailDemoPage } from "./pages/EmailDemoPage";
import { MembersPage } from "./pages/MembersPage";
import { NotificationPreferencesPage } from "./pages/NotificationPreferencesPage";
import { NotificationsPage } from "./pages/NotificationsPage";

import { QueueDemoPage } from "./pages/QueueDemoPage";
import { TrashPage } from "./pages/TrashPage";
import { UploadDemoPage } from "./pages/UploadDemoPage";
import { rootRoute } from "./root-route";

const appIndexRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app",
  beforeLoad: () => {
    throw redirect({ to: "/app/dashboard" });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/dashboard",
  component: DashboardPage,
});

const profileRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/profile",
  beforeLoad: () => {
    throw redirect({ to: "/app/settings/account" });
  },
});

const membersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/members",
  component: MembersPage,
});

const billingRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/billing",
  component: BillingPage,
});

const trashRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/trash",
  component: TrashPage,
});

const uploadDemoRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/upload-demo",
  component: UploadDemoPage,
});

const queueDemoRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/queue-demo",
  component: QueueDemoPage,
});

const emailDemoRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/email-demo",
  component: EmailDemoPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/notifications",
  component: NotificationsPage,
});

const notificationPreferencesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/notifications/preferences",
  component: NotificationPreferencesPage,
});

const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([
    settingsLayoutRoute.addChildren(settingsRoutes),
    appIndexRoute,
    dashboardRoute,
    profileRoute,
    membersRoute,
    billingRoute,
    trashRoute,
    uploadDemoRoute,
    queueDemoRoute,
    emailDemoRoute,
    notificationsRoute,
    notificationPreferencesRoute,
  ]),
  // The admin portal (/admin/*): its pages are the adminRoutes array.
  adminLayoutRoute.addChildren(adminRoutes),
]);

export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
