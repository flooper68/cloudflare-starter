import {
  AdminSettings,
  DataState,
  EmptyState,
  SkeletonText,
} from "@cloudflare-starter/ui";
import { Settings } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/** Cloudflare's dashboard page for Queues: background jobs are watched there. */
const QUEUES_DASHBOARD =
  "https://dash.cloudflare.com/?to=/:account/workers/queues";

/** `/admin/settings`: the deployment's settings, read-only. */
export function AdminSettingsPage() {
  const data = useAsync(() => trpc.admin.settings.get.query(), "settings");
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-fg">Settings</h1>
      <DataState
        status={data.status}
        data={data.data}
        error={data.error}
        onRetry={data.refetch}
        loading={<SkeletonText lines={8} />}
        empty={<EmptyState icon={<Settings />} title="No settings" />}
      >
        {(settings) => (
          <AdminSettings
            settings={settings}
            queuesDashboardUrl={
              settings.environment === "local" ? undefined : QUEUES_DASHBOARD
            }
          />
        )}
      </DataState>
    </section>
  );
}
