import { Activity, Target } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "../badge";
import { Button } from "../button";
import {
  createDataTableColumnHelper,
  DataTable,
  type DataTableColumnDef,
} from "../data-table";
import { RelativeTime } from "../timeline";
import { type Filter, FilterBar, type FilterProperty } from "./filter-bar";

export interface AdminAuditRow {
  readonly id: string;
  readonly occurredAt: Date | string;
  readonly action: string;
  readonly outcome: "success" | "failure";
  readonly actor: {
    readonly kind: "user" | "admin" | "system";
    readonly userId: string | null;
    readonly impersonatorUserId: string | null;
  };
  readonly target: { readonly type: string; readonly id: string };
  readonly workspaceId: string | null;
  readonly traceId: string;
}

/** Server-side filters of the audit page. */
export interface AdminAuditFilters {
  readonly action?: string;
  readonly targetType?: string;
}

const helper = createDataTableColumnHelper<AdminAuditRow>();

const columns: DataTableColumnDef<AdminAuditRow>[] = [
  helper.accessor("occurredAt", {
    header: "When",
    cell: ({ row }) => <RelativeTime date={row.original.occurredAt} />,
  }),
  helper.accessor("action", {
    header: "Action",
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <code className="text-xs">{row.original.action}</code>
        {row.original.outcome === "failure" ? (
          <Badge tone="danger">Failed</Badge>
        ) : null}
      </span>
    ),
  }),
  helper.accessor((row) => row.actor.userId ?? row.actor.kind, {
    id: "actor",
    header: "Actor",
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span className="truncate">
          {row.original.actor.userId ?? "System"}
        </span>
        <span className="text-xs text-fg-muted">
          {row.original.actor.kind}
          {row.original.actor.impersonatorUserId
            ? ` · impersonated by ${row.original.actor.impersonatorUserId}`
            : ""}
        </span>
      </span>
    ),
  }),
  helper.accessor((row) => `${row.target.type}:${row.target.id}`, {
    id: "target",
    header: "Target",
    meta: { cellClassName: "max-w-64 truncate text-fg-muted" },
  }),
  helper.accessor("traceId", {
    header: "Trace",
    meta: { cellClassName: "font-mono text-xs text-fg-muted" },
    cell: ({ row }) => row.original.traceId.slice(0, 12),
  }),
];

export interface AdminAuditTableProps {
  readonly events: readonly AdminAuditRow[];
  readonly onLoadMore?: () => void;
  readonly loadingMore?: boolean;
  readonly emptyState?: ReactNode;
}

/**
 * The audit log, newest first: when, action and outcome, who (with the impersonating
 * admin), what, and the trace id to find the request's logs. Pages come from the server.
 */
export function AdminAuditTable({
  events,
  onLoadMore,
  loadingMore = false,
  emptyState,
}: AdminAuditTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        data={events}
        columns={columns}
        getRowId={(event) => event.id}
        enableGlobalFilter={false}
        enableColumnVisibility={false}
        pageSize={200}
        pageSizeOptions={[200]}
        emptyState={emptyState ?? "No events match these filters."}
      />
      {onLoadMore ? (
        <Button
          className="self-center"
          loading={loadingMore}
          onClick={onLoadMore}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

export interface AdminAuditFilterBarProps {
  /** Every action of the catalog. */
  readonly actions: readonly string[];
  readonly targetTypes: readonly string[];
  readonly value: AdminAuditFilters;
  readonly onValueChange: (value: AdminAuditFilters) => void;
}

/** Action and target-type filter chips for the audit page (one value each). */
export function AdminAuditFilterBar({
  actions,
  targetTypes,
  value,
  onValueChange,
}: AdminAuditFilterBarProps) {
  const properties: FilterProperty[] = [
    {
      id: "action",
      label: "Action",
      icon: <Activity />,
      options: actions.map((action) => ({ value: action, label: action })),
    },
    {
      id: "targetType",
      label: "Target",
      icon: <Target />,
      options: targetTypes.map((type) => ({ value: type, label: type })),
    },
  ];
  const filters: Filter[] = (["action", "targetType"] as const).flatMap(
    (property) =>
      value[property]
        ? [
            {
              id: property,
              property,
              operator: "is" as const,
              values: [value[property] as string],
            },
          ]
        : []
  );
  const last = (next: readonly Filter[], property: string) =>
    next
      .filter(
        (filter) => filter.property === property && filter.operator === "is"
      )
      .flatMap((filter) => filter.values)
      .at(-1);
  return (
    <FilterBar
      properties={properties}
      value={filters}
      onValueChange={(next) =>
        onValueChange({
          action: last(next, "action"),
          targetType: last(next, "targetType"),
        })
      }
    />
  );
}
