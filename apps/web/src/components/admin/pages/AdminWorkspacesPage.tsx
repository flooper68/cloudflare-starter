import {
  AdminWorkspacesTable,
  Card,
  DataState,
  EmptyState,
  MembersTableSkeleton,
  SearchInput,
} from "@cloudflare-starter/ui";
import { useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { trpc } from "@/lib/trpc/client";

import { usePagedList } from "../use-paged-list";

/** `/admin/workspaces`: every workspace (not in personal mode). */
export function AdminWorkspacesPage() {
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
  return <WorkspacesList />;
}

function WorkspacesList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const list = usePagedList(
    (cursor) =>
      trpc.admin.workspaces.list.query({
        search: settled || undefined,
        cursor,
      }),
    settled
  );

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-fg">Workspaces</h1>
      <SearchInput
        aria-label="Search workspaces"
        placeholder="Search by name…"
        className="w-64"
        value={search}
        onValueChange={setSearch}
      />
      <Card className="p-0">
        <DataState
          status={list.first.status}
          data={list.first.data}
          error={list.first.error}
          onRetry={list.first.refetch}
          isEmpty={(page) => page.items.length === 0}
          loading={<MembersTableSkeleton rows={6} />}
          empty={
            <EmptyState
              variant="compact"
              icon={<Building2 />}
              title={settled ? "No workspaces match" : "No workspaces yet"}
              description={
                settled
                  ? "Try another name."
                  : "Workspaces appear here when people sign up or create them."
              }
            />
          }
        >
          {() => (
            <AdminWorkspacesTable
              workspaces={list.items}
              onOpen={(workspaceId) =>
                void navigate({
                  to: "/admin/workspaces/$workspaceId",
                  params: { workspaceId },
                })
              }
              onLoadMore={list.loadMore}
              loadingMore={list.loadingMore}
            />
          )}
        </DataState>
      </Card>
    </section>
  );
}
