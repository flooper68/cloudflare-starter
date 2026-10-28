import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthProvider, useAuth } from "@/components/shared/spa/auth-context";
import { WorkspaceProvider } from "@/components/shared/spa/workspace-context";
import { trackClientEvent } from "@/lib/analytics";
import { FeatureFlagsProvider } from "@/lib/feature-flags";
import { createAppRouter } from "./routes";

function AppSpaRouter() {
  const auth = useAuth();
  const [router] = useState(() => createAppRouter());

  useEffect(() => {
    if (!auth.user) {
      window.location.href = "/sign-in";
    }
  }, [auth.user]);

  // Product analytics: each shown page, by route pattern (never the URL with its ids).
  // The first page may resolve before this effect subscribes, so it also reports the
  // current location once; the href guard keeps each location to one event.
  useEffect(() => {
    let last: string | undefined;
    const report = () => {
      const href = router.state.resolvedLocation?.href;
      const route = router.state.matches.at(-1)?.routeId;
      if (!href || href === last || !route?.startsWith("/app")) return;
      last = href;
      trackClientEvent("app.page_viewed", { route });
    };
    const unsubscribe = router.subscribe("onResolved", report);
    report();
    return unsubscribe;
  }, [router]);

  if (!auth.user) {
    return null;
  }

  return (
    <WorkspaceProvider>
      <FeatureFlagsProvider>
        <RouterProvider router={router} />
      </FeatureFlagsProvider>
    </WorkspaceProvider>
  );
}

export function AppSpa() {
  return (
    <AuthProvider>
      <AppSpaRouter />
    </AuthProvider>
  );
}
