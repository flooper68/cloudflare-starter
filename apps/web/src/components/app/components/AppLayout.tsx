import {
  AppShell,
  AppTopBar,
  EmptyState,
  ErrorState,
  ImpersonationBanner,
  SkeletonCard,
  Toaster,
  toast,
} from "@cloudflare-starter/ui";
import { Outlet, useLocation } from "@tanstack/react-router";
import { FolderX } from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trpc } from "@/lib/trpc/client";

import { TrialBanner } from "../billing/TrialBanner";
import { NotificationBellMenu } from "../notifications/NotificationBellMenu";
import { AppSidebar } from "./AppSidebar";

const titles: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/profile": "Profile",
  "/app/settings/account": "Account settings",
  "/app/settings/appearance": "Appearance & language",
  "/app/settings/security": "Security",
  "/app/settings/workspace": "Workspace settings",
  "/app/settings/privacy": "Privacy",
  "/app/members": "Members",
  "/app/billing": "Billing",
  "/app/trash": "Trash",
  "/app/upload-demo": "Upload demo",
  "/app/queue-demo": "Queue demo",
  "/app/email-demo": "Email demo",
  "/app/notifications": "Notifications",
  "/app/notifications/preferences": "Notification settings",
};

/** Pages act in the active workspace: wait for it, and say so when there is none. */
function WorkspaceGate() {
  const { list, active, mode } = useWorkspace();
  if (list.status === "pending" && !list.data) return <SkeletonCard />;
  if (list.status === "error") {
    return (
      <ErrorState
        title="Couldn't load your workspaces"
        error={list.error}
        onRetry={list.refetch}
      />
    );
  }
  if (!active) {
    return (
      <EmptyState
        icon={<FolderX />}
        title="You are not in a workspace"
        description={
          mode === "multi"
            ? "Create a workspace from the menu at the top left, or open an invitation link."
            : "Ask an owner of the workspace to invite you again."
        }
      />
    );
  }
  return <Outlet />;
}

/** While an admin impersonates this user: whose session it is, and the way back. */
function Impersonation() {
  const { user, impersonatedBy } = useAuth();
  if (!impersonatedBy || !user) return null;
  return (
    <ImpersonationBanner
      userName={user.name}
      userEmail={user.email}
      onStop={async () => {
        try {
          await trpc.admin.impersonation.stop.mutate();
          // A full load: the browser holds the admin's session again.
          window.location.href = `/admin/users/${encodeURIComponent(user.id)}`;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Couldn't stop");
        }
      }}
    />
  );
}

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <AppShell sidebar={<AppSidebar />}>
      <Impersonation />
      <TrialBanner />
      <AppTopBar
        title={
          <span className="truncate text-sm font-medium text-fg">
            {titles[pathname] ?? "Not found"}
          </span>
        }
        actions={<NotificationBellMenu />}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
          {pathname.startsWith("/app/settings") ? (
            <Outlet />
          ) : (
            <WorkspaceGate />
          )}
        </div>
      </div>
      <Toaster />
    </AppShell>
  );
}
