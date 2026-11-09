import {
  AdminAnalytics,
  AdminAnalyticsSkeleton,
  DataState,
  EmptyState,
} from "@cloudflare-starter/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

const PERIODS = [1, 7, 30] as const;
type Period = (typeof PERIODS)[number];

/** `?days=` of the URL, 7 when missing or not a period. */
export function periodOf(search: Record<string, unknown>): Period {
  const days = Number(search.days);
  return (PERIODS as readonly number[]).includes(days) ? (days as Period) : 7;
}

/**
 * `/admin/analytics`: the product funnel and its breakdowns for 24 hours, 7 or 30 days
 * (`?days=`, kept in the URL), read live from Workers Analytics Engine with the analytics
 * read token; nothing is stored. Without the token it says which settings to set.
 */
export function AdminAnalyticsPage() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const days = periodOf(search);
  const data = useAsync(
    () => trpc.admin.analytics.get.query({ days }),
    `analytics:${days}`
  );
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-fg">Analytics</h1>
      <DataState
        status={data.status}
        data={data.data}
        error={data.error}
        onRetry={data.refetch}
        loading={<AdminAnalyticsSkeleton />}
        empty={<EmptyState icon={<BarChart3 />} title="No data yet" />}
      >
        {(value) => (
          <AdminAnalytics
            data={value}
            days={days}
            onDaysChange={(next) =>
              void navigate({
                to: "/admin/analytics",
                search: { days: periodOf({ days: next }) },
              })
            }
          />
        )}
      </DataState>
    </section>
  );
}
