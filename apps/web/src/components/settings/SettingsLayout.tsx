import { Outlet, useLocation } from "@tanstack/react-router";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { settingsSections } from "./sections";

export function SettingsLayout() {
  const { mode, active } = useWorkspace();
  const { pathname } = useLocation();
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-fg">Settings</h1>
      <div className="grid gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav
          aria-label="Settings"
          className="flex flex-wrap gap-1 md:flex-col md:items-stretch"
        >
          {settingsSections
            .filter((item) =>
              item.visible({
                mode,
                role: active?.role,
                hasWorkspace: Boolean(active),
              })
            )
            .map((item) => (
              <a
                key={item.id}
                href={item.to}
                aria-current={pathname === item.to ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent ${pathname === item.to ? "bg-active text-fg" : "text-fg-muted hover:bg-hover hover:text-fg"}`}
              >
                {item.label}
              </a>
            ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
