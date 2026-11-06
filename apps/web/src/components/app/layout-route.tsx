import { createRoute } from "@tanstack/react-router";
import { AppLayout } from "./components/AppLayout";
import { AppNotFoundPage } from "./pages/AppNotFoundPage";
import { rootRoute } from "./root-route";

export const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app-layout",
  component: AppLayout,
  // Unknown /app paths render inside the shell, with its navigation.
  notFoundComponent: AppNotFoundPage,
});
