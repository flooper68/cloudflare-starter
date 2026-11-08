import { useMemo } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { authClient } from "@/lib/auth-client";

import type { NavContext } from "./navigation";

/** What navigation.ts filters by, for the signed-in user and their active workspace. */
export function useNavContext(): NavContext {
  const { admin, billing } = useAuth();
  const { mode, active } = useWorkspace();
  return useMemo(
    () => ({
      mode,
      workspace: active ? { kind: active.kind, role: active.role } : null,
      billingMode: billing.mode,
      admin,
    }),
    [mode, active, billing.mode, admin]
  );
}

/** Signs out and leaves the app (the sidebar's menu and the command palette). */
export async function signOut(): Promise<void> {
  await authClient.signOut();
  window.location.href = "/";
}
