import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthProvider, useAuth } from "@/components/shared/spa/auth-context";
import { createAppRouter } from "./routes";

function AppSpaRouter() {
  const auth = useAuth();
  const [router] = useState(() => createAppRouter());

  useEffect(() => {
    if (!auth.user) {
      window.location.href = "/sign-in";
    }
  }, [auth.user]);

  if (!auth.user) {
    return null;
  }

  return <RouterProvider router={router} />;
}

export function AppSpa() {
  return (
    <AuthProvider>
      <AppSpaRouter />
    </AuthProvider>
  );
}
