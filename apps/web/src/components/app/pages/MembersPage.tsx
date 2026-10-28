import {
  Card,
  DataState,
  EmptyState,
  InviteDialog,
  MembersTable,
  MembersTableSkeleton,
  toast,
} from "@cloudflare-starter/ui";
import { Users } from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/** Placeholder roles, as in packages/features/src/workspaces/domain/permissions.ts. */
const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "member", label: "Member" },
];

function failed(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Something went wrong");
}

/** `/app/members`: the active workspace's members and invitations (single and multi mode). */
export function MembersPage() {
  const { user } = useAuth();
  const { active } = useWorkspace();
  const workspaceId = active?.id ?? "";
  const canManage = active?.role === "owner";

  const data = useAsync(async () => {
    const [members, invitations] = await Promise.all([
      trpc.workspace.members.list.query({ workspaceId }),
      canManage
        ? trpc.workspace.invitations.list.query({ workspaceId })
        : Promise.resolve({ items: [] }),
    ]);
    return { members: members.items, invitations: invitations.items };
  }, `${workspaceId}:${canManage}`);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      await data.refetch();
    } catch (error) {
      failed(error);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-text">
            {active?.name}
          </p>
          <h2 className="text-3xl font-semibold text-fg">Members</h2>
          <p className="max-w-3xl text-sm leading-6 text-fg-muted">
            Everyone here sees this workspace's files. Owners invite people,
            change roles and remove members.
          </p>
        </div>
        {canManage ? (
          <InviteDialog
            roles={ROLES}
            defaultRole="member"
            workspaceName={active?.name}
            onInvite={async ({ email, role }) => {
              const sent = await trpc.workspace.invitations.create.mutate({
                workspaceId,
                email,
                role: role as "owner" | "member",
              });
              toast.success(
                sent.delivered
                  ? `Invitation sent to ${sent.email}`
                  : `Invitation for ${sent.email} created; the link is in the server log`
              );
              await data.refetch();
            }}
          />
        ) : null}
      </div>

      <Card className="p-0">
        <DataState
          status={data.status}
          data={data.data}
          error={data.error}
          onRetry={data.refetch}
          isEmpty={(value) => value.members.length === 0}
          loading={<MembersTableSkeleton />}
          empty={
            <EmptyState
              variant="compact"
              icon={<Users />}
              title="No members"
              description="Invite people to share this workspace."
            />
          }
        >
          {(value) => (
            <MembersTable
              members={value.members}
              invitations={value.invitations}
              roles={ROLES}
              currentUserId={user?.id ?? ""}
              canManage={canManage}
              onChangeRole={(userId, role) =>
                void run(
                  () =>
                    trpc.workspace.members.changeRole.mutate({
                      workspaceId,
                      userId,
                      role: role as "owner" | "member",
                    }),
                  "Role changed"
                )
              }
              onRemove={(userId) =>
                void run(
                  () =>
                    trpc.workspace.members.remove.mutate({
                      workspaceId,
                      userId,
                    }),
                  "Member removed"
                )
              }
              onRevoke={(invitationId) =>
                void run(
                  () =>
                    trpc.workspace.invitations.revoke.mutate({
                      workspaceId,
                      invitationId,
                    }),
                  "Invitation revoked"
                )
              }
            />
          )}
        </DataState>
      </Card>
    </section>
  );
}
