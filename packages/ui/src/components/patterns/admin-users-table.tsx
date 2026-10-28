import { Shield, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar } from "../avatar";
import { Badge } from "../badge";
import { Button } from "../button";
import {
  createDataTableColumnHelper,
  DataTable,
  type DataTableColumnDef,
} from "../data-table";
import { SearchInput } from "../search-input";
import { RelativeTime } from "../timeline";
import { type Filter, FilterBar, type FilterProperty } from "./filter-bar";

export interface AdminUserRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly role: "user" | "admin";
  readonly banned: boolean;
  readonly createdAt: Date | string;
  readonly lastSeenAt: Date | string | null;
}

/** The server-side filters of the user list. */
export interface AdminUserFilters {
  readonly search: string;
  readonly role?: "user" | "admin";
  readonly status?: "active" | "banned";
}

const helper = createDataTableColumnHelper<AdminUserRow>();

const columns: DataTableColumnDef<AdminUserRow>[] = [
  helper.accessor("name", {
    header: "Name",
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar name={row.original.name || row.original.email} size="sm" />
        <span className="truncate font-medium">{row.original.name}</span>
      </span>
    ),
  }),
  helper.accessor("email", {
    header: "Email",
    meta: { cellClassName: "text-fg-muted" },
  }),
  helper.accessor("role", {
    header: "Role",
    cell: ({ row }) =>
      row.original.role === "admin" ? (
        <Badge tone="info" icon={<ShieldCheck />}>
          Admin
        </Badge>
      ) : (
        <span className="text-fg-muted">User</span>
      ),
  }),
  helper.accessor("banned", {
    header: "Status",
    cell: ({ row }) =>
      row.original.banned ? (
        <Badge tone="danger">Suspended</Badge>
      ) : row.original.emailVerified ? (
        <Badge tone="success">Active</Badge>
      ) : (
        <Badge tone="warning">Unverified</Badge>
      ),
  }),
  helper.accessor("lastSeenAt", {
    header: "Last seen",
    enableGlobalFilter: false,
    cell: ({ row }) =>
      row.original.lastSeenAt ? (
        <RelativeTime date={row.original.lastSeenAt} />
      ) : (
        <span className="text-fg-muted">Never</span>
      ),
  }),
  helper.accessor("createdAt", {
    header: "Joined",
    enableGlobalFilter: false,
    cell: ({ row }) => <RelativeTime date={row.original.createdAt} />,
  }),
];

export interface AdminUsersTableProps {
  readonly users: readonly AdminUserRow[];
  readonly onOpen: (userId: string) => void;
  /** Shown when there are more pages on the server. */
  readonly onLoadMore?: () => void;
  readonly loadingMore?: boolean;
  /** What to show when nothing matches the filters. */
  readonly emptyState?: ReactNode;
}

/**
 * Every user of the app, one page at a time from the server: name, email, platform role,
 * status, last seen and joined. Clicking a row opens the user; "Load more" fetches the
 * next page.
 */
export function AdminUsersTable({
  users,
  onOpen,
  onLoadMore,
  loadingMore = false,
  emptyState,
}: AdminUsersTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        data={users}
        columns={columns}
        getRowId={(user) => user.id}
        onRowClick={(user) => onOpen(user.id)}
        enableGlobalFilter={false}
        enableColumnVisibility={false}
        pageSize={100}
        pageSizeOptions={[100]}
        emptyState={emptyState ?? "No users match these filters."}
      />
      {onLoadMore ? (
        <Button
          className="self-center"
          variant="secondary"
          loading={loadingMore}
          onClick={onLoadMore}
        >
          Load more
        </Button>
      ) : null}
    </div>
  );
}

const userProperties: FilterProperty[] = [
  {
    id: "role",
    label: "Role",
    icon: <Shield />,
    options: [
      { value: "admin", label: "Admin" },
      { value: "user", label: "User" },
    ],
  },
  {
    id: "status",
    label: "Status",
    icon: <UserRound />,
    options: [
      { value: "active", label: "Active" },
      { value: "banned", label: "Suspended" },
    ],
  },
];

/** A single chosen value of a property, or undefined when none or several are chosen. */
function single<T extends string>(
  filters: readonly Filter[],
  property: string
): T | undefined {
  const chosen = filters.filter(
    (filter) => filter.property === property && filter.operator === "is"
  );
  const values = chosen.flatMap((filter) => filter.values);
  return values.length === 1 ? (values[0] as T) : undefined;
}

export interface AdminUserFilterBarProps {
  readonly value: AdminUserFilters;
  readonly onValueChange: (value: AdminUserFilters) => void;
}

/** Search by name or email, plus Role and Status filter chips, for the user list. */
export function AdminUserFilterBar({
  value,
  onValueChange,
}: AdminUserFilterBarProps) {
  const filters: Filter[] = [
    ...(value.role
      ? [
          {
            id: "role",
            property: "role",
            operator: "is" as const,
            values: [value.role],
          },
        ]
      : []),
    ...(value.status
      ? [
          {
            id: "status",
            property: "status",
            operator: "is" as const,
            values: [value.status],
          },
        ]
      : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        aria-label="Search users"
        placeholder="Search name or email…"
        value={value.search}
        onValueChange={(search) => onValueChange({ ...value, search })}
        className="w-64"
      />
      <FilterBar
        className="flex-1"
        properties={userProperties}
        value={filters}
        onValueChange={(next) =>
          onValueChange({
            search: value.search,
            role: single(next, "role"),
            status: single(next, "status"),
          })
        }
      />
    </div>
  );
}
