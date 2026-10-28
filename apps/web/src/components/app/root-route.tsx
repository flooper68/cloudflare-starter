import { createRootRoute, Outlet } from "@tanstack/react-router";

import { AppNotFoundPage } from "./pages/AppNotFoundPage";

/**
 * The SPA's root: the app (`/app/*`, AppLayout) and the admin portal (`/admin/*`,
 * AdminLayout) hang below it as layout routes.
 */
export const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: AppNotFoundPage,
});
