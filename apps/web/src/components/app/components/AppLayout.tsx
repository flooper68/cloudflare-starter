import {
  AppShell,
  AppTopBar,
  brand,
  EmptyState,
  ErrorState,
  ImpersonationBanner,
  OfflineNotice,
  SkeletonCard,
  Toaster,
} from "@cloudflare-starter/ui";
import { Outlet, useLocation } from "@tanstack/react-router";
import { FolderX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { connectivity } from "@/lib/connectivity";
import { trpc } from "@/lib/trpc/client";

import { TrialBanner } from "../billing/TrialBanner";
import { AppCommandMenu } from "../command-palette/AppCommandMenu";
import { destinationTitle, documentTitle } from "../navigation";
import { NotificationBellMenu } from "../notifications/NotificationBellMenu";
import { PageTitleContext } from "../page-title";
import { stopImpersonating } from "../use-nav-context";
import { AppSidebar } from "./AppSidebar";

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
      onStop={() => stopImpersonating(user.id)}
    />
  );
}

/**
 * While the browser is offline or the app's requests get no response: says so, and
 * "Try again" sends one cheap request (any answer clears the notice).
 */
function Offline() {
  const online = useSyncExternalStore(
    connectivity.subscribe,
    connectivity.getSnapshot,
    () => true
  );
  const [checking, setChecking] = useState(false);
  if (online) return null;
  return (
    <OfflineNotice
      retrying={checking}
      onRetry={async () => {
        setChecking(true);
        try {
          await trpc.public.hello.query();
        } catch {
          // Still unreachable: the notice stays.
        } finally {
          setChecking(false);
        }
      }}
    />
  );
}

export function AppLayout() {
  const { pathname } = useLocation();
  // A page's own title (one note's), set with usePageTitle while it is shown.
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const navTitle = destinationTitle(pathname) ?? "Not found";
  const tabTitle = documentTitle(pageTitle ?? navTitle, brand);

  // The browser tab names the page: "Dashboard · Starter", the note's title on a note.
  useEffect(() => {
    document.title = tabTitle;
  }, [tabTitle]);

  return (
    <PageTitleContext.Provider value={setPageTitle}>
      <AppShell sidebar={<AppSidebar />}>
        <Offline />
        <Impersonation />
        <TrialBanner />
        <AppTopBar
          title={
            <span className="truncate text-sm font-medium text-fg">
              {navTitle}
            </span>
          }
          actions={
            <>
              <AppCommandMenu />
              <NotificationBellMenu />
            </>
          }
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
    </PageTitleContext.Provider>
  );
}
