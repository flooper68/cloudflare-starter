import {
  Activity,
  Building2,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { Card } from "../card";
import { Skeleton } from "../skeleton";
import { Sparkline, Stat } from "../stat";

export interface AdminDailyCount {
  /** UTC day, `YYYY-MM-DD`. */
  readonly date: string;
  readonly count: number;
}

export interface AdminOverviewData {
  readonly users: {
    readonly total: number;
    readonly admins: number;
    readonly banned: number;
  };
  readonly signUps: readonly AdminDailyCount[];
  readonly activeUsers: readonly AdminDailyCount[];
  readonly workspaces: {
    readonly total: number;
    readonly shared: number;
    readonly personal: number;
    readonly sizes: readonly {
      readonly label: string;
      readonly count: number;
    }[];
  } | null;
}

export interface AdminOverviewProps {
  readonly data: AdminOverviewData;
}

const number = new Intl.NumberFormat("en");
const sum = (series: readonly AdminDailyCount[]) =>
  series.reduce((total, day) => total + day.count, 0);

/**
 * The admin portal's overview: users (admins, suspended), sign-ups and active users over
 * the last 30 days with sparklines, and workspace counts and sizes. `workspaces` is null
 * where workspaces are not administered (personal mode).
 */
export function AdminOverview({ data }: AdminOverviewProps) {
  const today = data.activeUsers.at(-1)?.count ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Users />}
          label="Users"
          value={number.format(data.users.total)}
        />
        <Stat
          icon={<UserPlus />}
          label="Sign-ups, 30 days"
          value={number.format(sum(data.signUps))}
          sparkline={data.signUps.map((day) => day.count)}
        />
        <Stat
          icon={<Activity />}
          label="Active today"
          value={number.format(today)}
          sparkline={data.activeUsers.map((day) => day.count)}
        />
        <Stat
          icon={<ShieldCheck />}
          label="Admins / suspended"
          value={`${number.format(data.users.admins)} / ${number.format(data.users.banned)}`}
        />
      </div>
      {data.workspaces ? (
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-fg">
            <Building2 aria-hidden className="size-4 text-fg-muted" />
            Workspaces
          </div>
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              ["Total", data.workspaces.total],
              ["Shared", data.workspaces.shared],
              ["Personal", data.workspaces.personal],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums text-fg">
                  {number.format(Number(value))}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-fg-muted">Shared workspaces by size</p>
            <ul className="flex flex-col gap-1.5">
              {data.workspaces.sizes.map((bucket) => {
                const max = Math.max(
                  1,
                  ...(data.workspaces?.sizes.map((b) => b.count) ?? [])
                );
                return (
                  <li
                    key={bucket.label}
                    className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm"
                  >
                    <span className="text-fg-muted">{bucket.label}</span>
                    <span className="h-2 rounded-sm bg-hover">
                      <span
                        className="block h-2 rounded-sm bg-accent"
                        style={{ width: `${(bucket.count / max) * 100}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums text-fg">
                      {number.format(bucket.count)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      ) : null}
      <Card className="flex flex-col gap-2 p-4">
        <p className="text-sm font-medium text-fg">Sign-ups per day</p>
        <Sparkline
          data={data.signUps.map((day) => day.count)}
          width={640}
          height={64}
          area
          label={`Sign-ups per day, last ${data.signUps.length} days`}
          className="w-full"
        />
      </Card>
    </div>
  );
}

/** Loading placeholder shaped like the overview. */
export function AdminOverviewSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading overview"
      className="flex flex-col gap-6"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
