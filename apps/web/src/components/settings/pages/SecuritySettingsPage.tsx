import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataState,
  EmptyState,
  SkeletonCard,
  toast,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { useAuth } from "@/components/shared/spa/auth-context";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";
import { useFormatters } from "@/lib/use-formatters";

export function SecuritySettingsPage() {
  const { methods } = useAuth();
  const [busy, setBusy] = useState(false);
  const sessions = useAsync(
    () => trpc.account.sessions.list.query(),
    "sessions"
  );
  const accounts = useAsync(async () => {
    const result = await authClient.listAccounts();
    if (result.error) throw new Error(authErrorMessage(result.error));
    return result.data ?? [];
  }, "linked-accounts");
  const { dateTime } = useFormatters();
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update security settings"
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-fg">Security</h2>
      {methods.emailPassword ? <ChangePasswordForm /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataState
            {...accounts}
            onRetry={accounts.refetch}
            loading={<SkeletonCard />}
            empty={
              <EmptyState
                title="No connected accounts"
                description="Connect an available sign-in provider below."
              />
            }
          >
            {(items) => (
              <ul className="space-y-3">
                {items.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-fg">
                      {account.providerId === "credential"
                        ? "Email and password"
                        : account.providerId}
                    </span>
                    {account.providerId !== "credential" ? (
                      <Button
                        disabled={busy || items.length < 2}
                        onClick={() =>
                          void run(async () => {
                            const result = await authClient.unlinkAccount({
                              accountId: account.id,
                            });
                            if (result.error)
                              throw new Error(authErrorMessage(result.error));
                            await accounts.refetch();
                            toast.success("Account disconnected");
                          })
                        }
                      >
                        Disconnect {account.providerId}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </DataState>
          {methods.google ? (
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await authClient.linkSocial({
                    provider: "google",
                    callbackURL: "/app/settings/security",
                  });
                  if (result.error)
                    throw new Error(authErrorMessage(result.error));
                })
              }
            >
              Connect Google
            </Button>
          ) : null}
          <p className="text-xs text-fg-muted">
            At least one sign-in method must stay connected. Linked accounts
            must use the same email address.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataState
            {...sessions}
            onRetry={sessions.refetch}
            loading={<SkeletonCard />}
            empty={
              <EmptyState
                title="No active browser sessions"
                description="Connected agents can manage settings without a browser session."
              />
            }
          >
            {(data) => (
              <ul className="space-y-4">
                {data.items.map((session) => (
                  <li
                    key={session.id}
                    className="space-y-2 border-b border-line pb-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm text-fg">
                          {session.userAgent || "Unknown device"}
                          {session.current ? " · This session" : ""}
                        </p>
                        <p className="text-xs text-fg-muted">
                          {session.ipAddress || "Unknown address"} · Signed in{" "}
                          {dateTime(new Date(session.createdAt))}
                        </p>
                      </div>
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await trpc.account.sessions.revoke.mutate({
                              sessionId: session.id,
                            });
                            if (session.current)
                              window.location.href = "/sign-in";
                            else {
                              await sessions.refetch();
                              toast.success("Session signed out");
                            }
                          })
                        }
                      >
                        Sign out{session.current ? " this session" : " session"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
