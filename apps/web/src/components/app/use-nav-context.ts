import { toast } from "@cloudflare-starter/ui";
import { useMemo } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";

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

/** Signs out and leaves the app (the profile menu and the command palette). */
export async function signOut(): Promise<void> {
  await authClient.signOut();
  window.location.href = "/";
}

/**
 * Ends an admin's impersonation of `userId` and goes back to that user's admin page (the
 * impersonation banner and the profile menu). A full load: the browser holds the admin's
 * session again.
 */
export async function stopImpersonating(userId: string): Promise<void> {
  try {
    await trpc.admin.impersonation.stop.mutate();
    window.location.href = `/admin/users/${encodeURIComponent(userId)}`;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Couldn't stop");
  }
}
