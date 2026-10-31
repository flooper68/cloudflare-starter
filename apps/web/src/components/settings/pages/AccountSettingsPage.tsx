import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataState,
  EmptyState,
  Field,
  Input,
  SkeletonCard,
  toast,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { useAuth } from "@/components/shared/spa/auth-context";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

export function AccountSettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const loaded = useAsync(
    () => trpc.account.settings.get.query(),
    "account-settings"
  );
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-fg">Account settings</h2>
      <p className="text-sm text-fg-muted">{user?.email}</p>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await authClient.updateUser({ name });
                if (result.error)
                  throw new Error(authErrorMessage(result.error));
                toast.success("Profile saved");
                window.location.reload();
              });
            }}
          >
            <Field label="Name">
              <Input
                value={name}
                required
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Save profile
            </Button>
          </form>
          <DataState
            {...loaded}
            onRetry={loaded.refetch}
            loading={<SkeletonCard />}
            empty={
              <EmptyState
                title="Profile unavailable"
                description="Reload this page to try again."
              />
            }
          >
            {(settings) => (
              <div className="space-y-3">
                <Avatar
                  name={name}
                  src={settings.avatarUrl ?? user?.image ?? undefined}
                  size="lg"
                />
                <Field
                  label="Upload avatar"
                  description="PNG, JPEG or WebP, up to 1 MB."
                >
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file)
                        void run(async () => {
                          const response = await fetch("/api/account/avatar", {
                            method: "POST",
                            headers: { "content-type": file.type },
                            body: file,
                          });
                          if (!response.ok) {
                            const error = (await response.json()) as {
                              detail?: string;
                            };
                            throw new Error(
                              error.detail ?? "Unable to upload image"
                            );
                          }
                          await loaded.refetch();
                          toast.success("Avatar updated");
                          window.location.reload();
                        });
                    }}
                  />
                </Field>
                {settings.avatarUrl ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await trpc.account.removeAvatar.mutate();
                        await loaded.refetch();
                        toast.success("Custom avatar removed");
                        // Bootstrap includes the effective image used by the shell.
                        // Refresh it so removal restores the provider image too.
                        window.location.reload();
                      })
                    }
                  >
                    Remove avatar
                  </Button>
                ) : null}
              </div>
            )}
          </DataState>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Email address</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const result = await authClient.changeEmail({
                  newEmail: email,
                  callbackURL: "/app/settings/account",
                });
                if (result.error)
                  throw new Error(authErrorMessage(result.error));
                setEmail("");
                toast.success("Check your email to confirm the change");
              });
            }}
          >
            <Field
              label="New email address"
              description="Your address changes only after verification."
            >
              <Input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Change email
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
