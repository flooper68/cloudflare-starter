import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@cloudflare-starter/ui";

import { useUser } from "@/components/shared/hooks/use-clerk-client";
import { ChangePasswordForm } from "./ChangePasswordForm";

function getInitials(fullName: string | null | undefined, email: string) {
  const fromName =
    fullName
      ?.split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("") ?? "";

  if (fromName) {
    return fromName.toUpperCase();
  }

  return email.slice(0, 2).toUpperCase();
}

export function ProfilePageClient() {
  const user = useUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const fallbackName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(" ");
  const name = user?.fullName ?? (fallbackName || "Your profile");
  const initials = getInitials(user?.fullName, email || "me");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="space-y-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <p className="text-sm text-zinc-600">
            This is a lightweight account page for the starter app. Clerk owns
            authentication; the app shows the current identity and lets you
            manage password changes in place.
          </p>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {user?.imageUrl ? (
              <img
                alt={name}
                className="h-20 w-20 rounded-full object-cover"
                src={user.imageUrl}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-950 text-2xl font-semibold text-white">
                {initials}
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xl font-semibold text-zinc-950">{name}</p>
              <p className="text-sm text-zinc-600">{email}</p>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">
                Clerk user {user?.id ?? "loading"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                First name
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-950">
                {user?.firstName ?? "Not set"}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Last name
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-950">
                {user?.lastName ?? "Not set"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordForm />
    </div>
  );
}
