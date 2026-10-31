import {
  Card,
  DataState,
  EmptyState,
  TrashList,
  type TrashListItem,
  TrashListSkeleton,
  toast,
} from "@cloudflare-starter/ui";
import { Trash2 } from "lucide-react";

import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

function failed(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Something went wrong");
}

/** `/app/trash`: the active workspace's trash; members restore, owners also purge. */
export function TrashPage() {
  const { active } = useWorkspace();
  const workspaceId = active?.id ?? "";

  const trash = useAsync(async () => {
    // Every page, so the list (and the count the "Empty trash" dialog names) is complete.
    let page = await trpc.trash.list.query({ workspaceId, limit: 100 });
    const all = [...page.items];
    while (page.nextCursor) {
      page = await trpc.trash.list.query({
        workspaceId,
        limit: 100,
        cursor: page.nextCursor,
      });
      all.push(...page.items);
    }
    return {
      can: page.can,
      items: all.map(
        (item): TrashListItem => ({
          type: item.type,
          id: item.id,
          label: item.label,
          sizeBytes: item.sizeBytes,
          deletedAt: item.deletedAt,
          deletedByName: item.deletedBy?.name ?? null,
          purgeAt: item.purgeAt,
        })
      ),
    };
  }, workspaceId);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      await trash.refetch();
    } catch (error) {
      failed(error);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent-text">
          {active?.name}
        </p>
        <h2 className="text-3xl font-semibold text-fg">Trash</h2>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          Deleted files stay here for 30 days, then they are deleted for good.
          Members restore them; owners can delete them sooner.
        </p>
      </div>

      <Card>
        <DataState
          status={trash.status}
          data={trash.data}
          error={trash.error}
          onRetry={trash.refetch}
          loading={<TrashListSkeleton />}
          empty={
            <EmptyState
              variant="compact"
              icon={<Trash2 />}
              title="Trash is empty"
              description="Files you delete stay here for 30 days before they are deleted for good."
            />
          }
        >
          {(value) => (
            <TrashList
              items={value.items}
              canRestore={value.can.restore}
              canPurge={value.can.purge}
              onRestore={(item) =>
                void run(
                  () =>
                    trpc.trash.restore.mutate({
                      workspaceId,
                      items: [{ type: item.type, id: item.id }],
                    }),
                  `Restored ${item.label}`
                )
              }
              onDeletePermanently={(item) =>
                void run(
                  () =>
                    trpc.trash.deletePermanently.mutate({
                      workspaceId,
                      items: [{ type: item.type, id: item.id }],
                    }),
                  `Deleted ${item.label} permanently`
                )
              }
              onEmpty={() =>
                void run(async () => {
                  // The server empties up to 1000 items per call.
                  let remaining = true;
                  while (remaining) {
                    ({ remaining } = await trpc.trash.empty.mutate({
                      workspaceId,
                    }));
                  }
                }, "Trash emptied")
              }
            />
          )}
        </DataState>
      </Card>
    </section>
  );
}
