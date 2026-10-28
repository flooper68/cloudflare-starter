import {
  AdminWorkspaceDetail,
  AdminWorkspaceDetailSkeleton,
  DataState,
  EmptyState,
} from "@cloudflare-starter/ui";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Building2 } from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

import { useAdminAction } from "../use-admin-action";

/** `/admin/workspaces/$workspaceId`: members, owner rescue, deletion (not in personal mode). */
export function AdminWorkspacePage() {
  const { workspace } = useAuth();
  if (workspace.mode === "personal") {
    return (
      <EmptyState
        icon={<Building2 />}
        title="No workspaces to administer"
        description="In personal mode every workspace belongs to one user and goes with their account."
      />
    );
  }
  return <WorkspaceDetailPage />;
}

function WorkspaceDetailPage() {
  const { workspaceId = "" } = useParams({ strict: false });
  const navigate = useNavigate();
  const { run, dialog } = useAdminAction();
  const data = useAsync(
    () => trpc.admin.workspaces.get.query({ workspaceId }),
    `workspace:${workspaceId}`
  );

  return (
    <section className="flex flex-col gap-6">
      <Link
        to="/admin/workspaces"
        className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden className="size-4" />
        All workspaces
      </Link>
      <DataState
        status={data.status}
        data={data.data}
        error={data.error}
        onRetry={data.refetch}
        loading={<AdminWorkspaceDetailSkeleton />}
        empty={<EmptyState icon={<Building2 />} title="Workspace not found" />}
      >
        {(workspace) => (
          <AdminWorkspaceDetail
            workspace={workspace}
            onOpenUser={(userId) =>
              void navigate({ to: "/admin/users/$userId", params: { userId } })
            }
            onAssignOwner={async (userId) => {
              if (
                await run(
                  () =>
                    trpc.admin.workspaces.assignOwner.mutate({
                      workspaceId,
                      userId,
                    }),
                  "Owner assigned"
                )
              ) {
                await data.refetch();
              }
            }}
            onDelete={async () => {
              if (
                await run(
                  () => trpc.admin.workspaces.delete.mutate({ workspaceId }),
                  `${workspace.name} is deleted`
                )
              ) {
                await navigate({ to: "/admin/workspaces" });
              }
            }}
          />
        )}
      </DataState>
      {dialog}
    </section>
  );
}
