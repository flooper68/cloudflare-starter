import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@cloudflare-starter/ui";

import { useAuth } from "@/components/shared/spa/auth-context";
import { initials } from "@/lib/user";
import { ChangePasswordForm } from "./ChangePasswordForm";

export function ProfilePageClient() {
  const { user, methods } = useAuth();

  const email = user?.email ?? "";
  const name = user?.name || "Your profile";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="space-y-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <p className="text-sm text-zinc-600">
            This is a lightweight account page for the starter app. Better Auth
            owns authentication and stores users in D1; the app shows the
            current identity and lets you change your password in place.
          </p>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {user?.image ? (
              <img
                alt={name}
                className="h-20 w-20 rounded-full object-cover"
                src={user.image}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-950 text-2xl font-semibold text-white">
                {initials({ name: user?.name, email: email || "me" })}
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xl font-semibold text-zinc-950">{name}</p>
              <p className="text-sm text-zinc-600">{email}</p>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">
                User {user?.id ?? "loading"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {methods.emailPassword ? <ChangePasswordForm /> : null}
    </div>
  );
}
