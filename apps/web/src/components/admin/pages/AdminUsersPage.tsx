import {
  AdminUserFilterBar,
  type AdminUserFilters,
  AdminUsersTable,
  Card,
  DataState,
  EmptyState,
  MembersTableSkeleton,
} from "@cloudflare-starter/ui";
import { useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc/client";

import { usePagedList } from "../use-paged-list";

/** The search waits for typing to pause before asking the server. */
function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** `/admin/users`: every user, searched and filtered on the server. */
export function AdminUsersPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AdminUserFilters>({ search: "" });
  const search = useDebounced(filters.search.trim());
  const query = {
    search: search || undefined,
    role: filters.role,
    status: filters.status,
  };
  const list = usePagedList(
    (cursor) => trpc.admin.users.list.query({ ...query, cursor }),
    JSON.stringify(query)
  );
  const filtered = Boolean(query.search || query.role || query.status);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-fg">Users</h1>
      <AdminUserFilterBar value={filters} onValueChange={setFilters} />
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
              icon={<Users />}
              title={filtered ? "No users match" : "No users yet"}
              description={
                filtered
                  ? "Change the search or remove a filter."
                  : "People appear here when they sign up."
              }
            />
          }
        >
          {() => (
            <AdminUsersTable
              users={list.items}
              onOpen={(userId) =>
                void navigate({
                  to: "/admin/users/$userId",
                  params: { userId },
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
