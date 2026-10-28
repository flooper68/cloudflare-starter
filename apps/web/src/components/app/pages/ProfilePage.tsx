import { ProfilePageClient } from "@/components/profile/ProfilePageClient";

export function ProfilePage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          Profile
        </p>
        <h2 className="text-3xl font-semibold text-fg">Account settings</h2>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          Better Auth owns authentication. This page surfaces the signed-in
          identity and keeps password management inside the app shell.
        </p>
      </div>

      <ProfilePageClient />
    </section>
  );
}
