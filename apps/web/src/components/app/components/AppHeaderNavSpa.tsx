import { cn, ProfileMenu, type ProfileMenuItem } from "@cloudflare-starter/ui";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import { useAuth } from "@/components/shared/spa/auth-context";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/user";

const links = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/profile", label: "Profile" },
  { href: "/app/upload-demo", label: "Upload" },
  { href: "/app/queue-demo", label: "Queue" },
  { href: "/app/email-demo", label: "Email" },
] as const;

async function signOut() {
  await authClient.signOut();
  window.location.href = "/";
}

export function AppHeaderNavSpa() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const menuItems: readonly ProfileMenuItem[] = [
    {
      label: "Profile",
      onSelect: () => {
        void navigate({ to: "/app/profile" });
      },
    },
  ];

  return (
    <header className="rounded-[2rem] border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">
              Cloudflare Starter App
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
              Authenticated demos under one client-routed app shell.
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Public and auth pages stay Astro SSR. Once you enter `/app/*`,
              navigation stays inside the React SPA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-50"
              href="/"
            >
              Back home
            </a>
            {user ? (
              <ProfileMenu
                userName={user.name || "Signed in"}
                userEmail={user.email}
                userImageUrl={user.image}
                userInitials={initials(user)}
                menuItems={menuItems}
                onSignOut={() => void signOut()}
              />
            ) : null}
          </div>
        </div>

        <nav className="flex flex-wrap gap-3">
          {links.map((link) => {
            const active = location.pathname === link.href;

            return (
              <Link
                key={link.href}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  active
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-300 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
                )}
                to={link.href}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
