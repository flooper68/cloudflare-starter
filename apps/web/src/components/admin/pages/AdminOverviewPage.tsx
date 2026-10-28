import {
  AdminOverview,
  AdminOverviewSkeleton,
  DataState,
  EmptyState,
} from "@cloudflare-starter/ui";
import { LayoutDashboard } from "lucide-react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/** `/admin/overview`: users, sign-ups, activity and workspaces, from D1. */
export function AdminOverviewPage() {
  const { workspace } = useAuth();
  const data = useAsync(() => trpc.admin.overview.get.query(), "overview");
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-fg">Overview</h1>
      <DataState
        status={data.status}
        data={data.data}
        error={data.error}
        onRetry={data.refetch}
        loading={<AdminOverviewSkeleton />}
        empty={<EmptyState icon={<LayoutDashboard />} title="No data yet" />}
      >
        {(value) => (
          <AdminOverview
            data={{
              ...value,
              workspaces:
                workspace.mode === "personal" ? null : value.workspaces,
            }}
          />
        )}
      </DataState>
    </section>
  );
}
