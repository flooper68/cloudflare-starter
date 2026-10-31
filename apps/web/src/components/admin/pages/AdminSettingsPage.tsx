import {
  AdminSettings,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataState,
  EmptyState,
  SkeletonText,
} from "@cloudflare-starter/ui";
import { Settings } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";
import { useAdminAction } from "../use-admin-action";

/** Cloudflare's dashboard page for Queues: background jobs are watched there. */
const QUEUES_DASHBOARD =
  "https://dash.cloudflare.com/?to=/:account/workers/queues";

/** `/admin/settings`: the deployment's settings, read-only. */
export function AdminSettingsPage() {
  const data = useAsync(() => trpc.admin.settings.get.query(), "settings");
  const storage = useAsync(
    () => trpc.admin.storage.status.query(),
    "storage-settings"
  );
  const { run, dialog } = useAdminAction();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  async function start(deleting: boolean) {
    setBusy(true);
    try {
      await run(
        async () => {
          const result = deleting
            ? await trpc.admin.storage.deleteOrphans.mutate()
            : await trpc.admin.storage.reconcile.mutate();
          setLastRun(result.runId);
          setConfirm(false);
        },
        deleting ? "Storage cleanup queued" : "Storage report queued"
      );
    } finally {
      setBusy(false);
    }
  }
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
      <DataState
        status={storage.status}
        data={storage.data}
        error={storage.error}
        onRetry={storage.refetch}
        loading={<SkeletonText lines={4} />}
        empty={<EmptyState title="Storage maintenance unavailable" />}
      >
        {(value) => (
          <Card>
            <CardHeader>
              <CardTitle>Storage maintenance</CardTitle>
              <CardDescription>
                Find files left behind after deletion. Active files, trash and
                recent uploads are protected.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-fg-muted">
                Daily maintenance: {value.mode}. Only unreferenced objects older
                than {value.graceHours} hours are eligible.
              </p>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => void start(false)}>
                  Run storage report
                </Button>
                {value.mode === "delete" && (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => setConfirm(true)}
                  >
                    Delete orphaned objects
                  </Button>
                )}
              </div>
              {lastRun && (
                <p className="text-sm text-fg-muted" role="status">
                  Queued run {lastRun}. Check the audit log for page results.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </DataState>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete orphaned objects?"
        description="This permanently removes unreferenced objects older than 24 hours. Review a storage report first. Active files and trash are preserved."
        confirmLabel="Delete orphaned objects"
        tone="danger"
        onConfirm={() => void start(true)}
      />
      {dialog}
    </section>
  );
}
