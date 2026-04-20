import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AuthProvider, useAuth } from "@/components/shared/spa/auth-context";
import { createAppRouter } from "./routes";

function AppSpaRouter() {
  const auth = useAuth();
  const [router] = useState(() => createAppRouter());

  useEffect(() => {
    if (!auth.userId) {
      window.location.href = "/sign-in";
    }
  }, [auth.userId]);

  if (!auth.userId) {
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
