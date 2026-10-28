import {
  AdminFlagCard,
  DataState,
  EmptyState,
  SkeletonCard,
} from "@cloudflare-starter/ui";
import { Flag } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

import { useAdminAction } from "../use-admin-action";

/** `/admin/flags`: the feature-flag catalog with switches and targeting rules. */
export function AdminFlagsPage() {
  const { run, dialog } = useAdminAction();
  const data = useAsync(() => trpc.admin.flags.list.query(), "flags");

  async function act(action: () => Promise<unknown>, done: string) {
    const ok = await run(action, done);
    await data.refetch();
    if (!ok) throw new Error("Not saved");
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-fg">Feature flags</h1>
        <p className="max-w-3xl text-sm text-fg-muted">
          Changes reach every isolate within 30 seconds. Flags are defined in
          the catalog (packages/features/src/feature-flags).
        </p>
      </div>
      <DataState
        status={data.status}
        data={data.data?.flags}
        error={data.error}
        onRetry={data.refetch}
        isEmpty={(flags) => flags.length === 0}
        loading={<SkeletonCard />}
        empty={<EmptyState icon={<Flag />} title="No feature flags" />}
      >
        {(flags) =>
          flags.map((flag) => (
            <AdminFlagCard
              key={flag.key}
              definition={flag}
              onToggle={(enabled) =>
                act(
                  () =>
                    trpc.admin.flags.update.mutate({
                      key: flag.key,
                      enabled,
                      fallthrough:
                        flag.stored && !("invalid" in flag.stored)
                          ? flag.stored.fallthrough
                          : null,
                    }),
                  `${flag.key} is ${enabled ? "on" : "off"}`
                )
              }
              onSaveRules={(rules) =>
                act(
                  () =>
                    trpc.admin.flags.setRules.mutate({ key: flag.key, rules }),
                  `Rules of ${flag.key} saved`
                )
              }
            />
          ))
        }
      </DataState>
      {dialog}
    </section>
  );
}
