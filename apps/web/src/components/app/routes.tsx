import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";

import { AppLayout } from "./components/AppLayout";
import { AppNotFoundPage } from "./pages/AppNotFoundPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmailDemoPage } from "./pages/EmailDemoPage";
import { MembersPage } from "./pages/MembersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { QueueDemoPage } from "./pages/QueueDemoPage";
import { TrashPage } from "./pages/TrashPage";
import { UploadDemoPage } from "./pages/UploadDemoPage";

const rootRoute = createRootRoute({
  component: AppLayout,
  notFoundComponent: AppNotFoundPage,
});

const appIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  beforeLoad: () => {
    throw redirect({ to: "/app/dashboard" });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/dashboard",
  component: DashboardPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/profile",
  component: ProfilePage,
});

const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/members",
  component: MembersPage,
});

const trashRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/trash",
  component: TrashPage,
});

const uploadDemoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/upload-demo",
  component: UploadDemoPage,
});

const queueDemoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/queue-demo",
  component: QueueDemoPage,
});

const emailDemoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/email-demo",
  component: EmailDemoPage,
});

const routeTree = rootRoute.addChildren([
  appIndexRoute,
  dashboardRoute,
  profileRoute,
  membersRoute,
  trashRoute,
  uploadDemoRoute,
  queueDemoRoute,
  emailDemoRoute,
]);

export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
