import {
  AdminHealth,
  AdminHealthSkeleton,
  AdminOverview,
  AdminOverviewSkeleton,
  DataState,
  EmptyState,
} from "@cloudflare-starter/ui";
import { HeartPulse, LayoutDashboard } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/** The deployment's readiness, checked live (the same checks as `/health/ready`). */
function HealthSection() {
  const health = useAsync(() => trpc.admin.health.get.query(), "health");
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await health.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <DataState
      status={health.status}
      data={health.data}
      error={health.error}
      onRetry={health.refetch}
      loading={<AdminHealthSkeleton />}
      empty={<EmptyState icon={<HeartPulse />} title="No checks ran" />}
    >
      {(value) => (
        <AdminHealth
          health={value}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
        />
      )}
    </DataState>
  );
}

/**
 * `/admin/overview`: the deployment's health (a live check, nothing stored), then users,
 * sign-ups, activity and workspaces, from D1.
 */
export function AdminOverviewPage() {
  const { workspace } = useAuth();
  const data = useAsync(() => trpc.admin.overview.get.query(), "overview");
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-fg">Overview</h1>
      <HealthSection />
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
