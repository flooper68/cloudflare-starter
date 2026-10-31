import {
  AdminUserDetail,
  AdminUserDetailSkeleton,
  DataState,
  EmptyState,
} from "@cloudflare-starter/ui";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, UserX } from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

import { useAdminAction } from "../use-admin-action";

/** `/admin/users/$userId`: one user and the admin actions on them. */
export function AdminUserPage() {
  const { userId = "" } = useParams({ strict: false });
  const navigate = useNavigate();
  const { user: me, workspace } = useAuth();
  const { run, dialog } = useAdminAction();
  const data = useAsync(
    () => trpc.admin.users.get.query({ userId }),
    `user:${userId}`
  );

  async function act(action: () => Promise<unknown>, done: string) {
    if (await run(action, done)) await data.refetch();
  }

  return (
    <section className="flex flex-col gap-6">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All users
      </Link>
      <DataState
        status={data.status}
        data={data.data}
        error={data.error}
        onRetry={data.refetch}
        loading={<AdminUserDetailSkeleton />}
        empty={<EmptyState icon={<UserX />} title="User not found" />}
      >
        {(user) => (
          <AdminUserDetail
            user={user}
            isSelf={user.id === me?.id}
            onOpenWorkspace={
              workspace.mode === "personal"
                ? undefined
                : (workspaceId) =>
                    void navigate({
                      to: "/admin/workspaces/$workspaceId",
                      params: { workspaceId },
                    })
            }
            onBan={({ reason, expiresAt }) =>
              act(
                () =>
                  trpc.admin.users.ban.mutate({
                    userId,
                    reason: reason || undefined,
                    expiresAt: expiresAt?.toISOString(),
                  }),
                `${user.name} is suspended`
              )
            }
            onUnban={() =>
              act(
                () => trpc.admin.users.unban.mutate({ userId }),
                `${user.name} can sign in again`
              )
            }
            onResetSecondFactor={() =>
              act(
                () => trpc.admin.users.resetSecondFactor.mutate({ userId }),
                "Two-factor authentication reset"
              )
            }
            onRevokeSessions={() =>
              act(
                () => trpc.admin.users.revokeSessions.mutate({ userId }),
                `${user.name} is signed out everywhere`
              )
            }
            onSetRole={(role) =>
              act(
                () => trpc.admin.users.setRole.mutate({ userId, role }),
                role === "admin"
                  ? `${user.name} is an admin`
                  : `${user.name} is no longer an admin`
              )
            }
            onSendPasswordReset={() =>
              act(
                () => trpc.admin.users.sendPasswordReset.mutate({ userId }),
                `Password reset link sent to ${user.email}`
              )
            }
            onImpersonate={async () => {
              if (
                await run(
                  () => trpc.admin.impersonation.start.mutate({ userId }),
                  `You are now signed in as ${user.name}`
                )
              ) {
                // A full load: the browser now holds the impersonation session.
                window.location.href = "/app/dashboard";
              }
            }}
            onRemove={async () => {
              if (
                await run(
                  () => trpc.admin.users.remove.mutate({ userId }),
                  `${user.name}'s account is deleted`
                )
              ) {
                await navigate({ to: "/admin/users" });
              }
            }}
          />
        )}
      </DataState>
      {dialog}
    </section>
  );
}
