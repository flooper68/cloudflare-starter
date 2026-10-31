import { createRoute } from "@tanstack/react-router";
import { AppLayout } from "./components/AppLayout";
import { rootRoute } from "./root-route";

export const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app-layout",
  component: AppLayout,
});
