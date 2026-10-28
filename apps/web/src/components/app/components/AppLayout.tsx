import { AppShell, AppTopBar, Toaster } from "@cloudflare-starter/ui";
import { Outlet, useLocation } from "@tanstack/react-router";

import { AppSidebar } from "./AppSidebar";

const titles: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/profile": "Profile",
  "/app/upload-demo": "Upload demo",
  "/app/queue-demo": "Queue demo",
  "/app/email-demo": "Email demo",
};

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
          <Outlet />
        </div>
      </div>
      <Toaster />
    </AppShell>
  );
}
