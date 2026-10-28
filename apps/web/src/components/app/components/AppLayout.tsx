import {
  AppShell,
  AppTopBar,
  EmptyState,
  ErrorState,
  SkeletonCard,
  Toaster,
} from "@cloudflare-starter/ui";
import { Outlet, useLocation } from "@tanstack/react-router";
import { FolderX } from "lucide-react";

import { useWorkspace } from "@/components/shared/spa/workspace-context";

import { AppSidebar } from "./AppSidebar";

const titles: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/profile": "Profile",
  "/app/members": "Members",
  "/app/upload-demo": "Upload demo",
  "/app/queue-demo": "Queue demo",
  "/app/email-demo": "Email demo",
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

export function AppLayout() {
  const { pathname } = useLocation();

  return (
    <AppShell sidebar={<AppSidebar />}>
      <AppTopBar
        title={
          <span className="truncate text-sm font-medium text-fg">
            {titles[pathname] ?? "Not found"}
          </span>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
          <WorkspaceGate />
        </div>
      </div>
      <Toaster />
    </AppShell>
  );
}
