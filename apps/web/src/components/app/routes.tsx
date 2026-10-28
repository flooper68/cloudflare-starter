import { createRoute, createRouter, redirect } from "@tanstack/react-router";

import { adminLayoutRoute, adminRoutes } from "@/components/admin/routes";

import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { EmailDemoPage } from "./pages/EmailDemoPage";
import { MembersPage } from "./pages/MembersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { QueueDemoPage } from "./pages/QueueDemoPage";
import { UploadDemoPage } from "./pages/UploadDemoPage";
import { rootRoute } from "./root-route";

/** The app's pages, inside the app shell (AppLayout). */
const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app-layout",
  component: AppLayout,
});

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
  component: ProfilePage,
});

const membersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/app/members",
  component: MembersPage,
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

const routeTree = rootRoute.addChildren([
  appLayoutRoute.addChildren([
    appIndexRoute,
    dashboardRoute,
    profileRoute,
    membersRoute,
    uploadDemoRoute,
    queueDemoRoute,
    emailDemoRoute,
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
