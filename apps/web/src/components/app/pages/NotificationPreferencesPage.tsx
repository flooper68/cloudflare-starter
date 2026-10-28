import {
  Card,
  NotificationPreferences,
  type NotificationPreferencesData,
  toast,
} from "@cloudflare-starter/ui";
import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/** `/app/notifications/preferences`: which notifications arrive in the app and by email. */
export function NotificationPreferencesPage() {
  const loaded = useAsync(
    () => trpc.notifications.preferences.get.query(),
    "preferences"
  );
  // Shown optimistically; a failed save reverts to the server's answer.
  const [data, setData] = useState<NotificationPreferencesData | undefined>();
  useEffect(() => setData(loaded.data), [loaded.data]);

  async function save(
    change: Parameters<typeof trpc.notifications.preferences.update.mutate>[0],
    optimistic: NotificationPreferencesData
  ) {
    setData(optimistic);
    try {
      await trpc.notifications.preferences.update.mutate(change);
      toast.success("Preferences saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      );
      await loaded.refetch();
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold text-fg">
          Notification settings
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-fg-muted">
          Choose what reaches you in the app and by email. Every mail has a link
          to unsubscribe from it; security notices are always sent.
        </p>
      </div>
      <Card className="p-0">
        <NotificationPreferences
          status={loaded.status}
          data={data}
          error={loaded.error}
          onRetry={loaded.refetch}
          onToggle={(type, channel, enabled) => {
            if (!data) return;
            void save(
              { changes: [{ type, channel, enabled }] },
              {
                ...data,
                types: data.types.map((row) =>
                  row.type === type ? { ...row, [channel]: enabled } : row
                ),
              }
            );
          }}
          onCadenceChange={(emailCadence) => {
            if (!data) return;
            void save({ changes: [], emailCadence }, { ...data, emailCadence });
          }}
        />
      </Card>
    </section>
  );
}
