import { Trash2, TriangleAlert, UserCog } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { useConfirm } from "../alert-dialog";
import { Avatar } from "../avatar";
import { Badge } from "../badge";
import { Button } from "../button";
import { Callout } from "../callout";
import { Card } from "../card";
import {
  createDataTableColumnHelper,
  DataTable,
  type DataTableColumnDef,
} from "../data-table";
import { Field } from "../field";
import { Input } from "../input";
import { Skeleton, SkeletonText } from "../skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";
import { RelativeTime } from "../timeline";

export interface AdminWorkspaceRow {
  readonly id: string;
  readonly name: string;
  readonly kind: "personal" | "shared";
  readonly createdAt: Date | string;
  readonly memberCount: number;
  /** Members who can manage members (owners); 0 means it needs a new owner. */
  readonly managerCount: number;
}

const helper = createDataTableColumnHelper<AdminWorkspaceRow>();

const columns: DataTableColumnDef<AdminWorkspaceRow>[] = [
  helper.accessor("name", {
    header: "Name",
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="font-medium">{row.original.name}</span>
        {row.original.kind === "shared" && row.original.managerCount === 0 ? (
          // Neutral fill: a tinted one is too faint under small text on a hovered row.
          <Badge
            tone="neutral"
            icon={<TriangleAlert className="text-warning" />}
          >
            No owner
          </Badge>
        ) : null}
      </span>
    ),
  }),
  helper.accessor("kind", {
    header: "Kind",
    cell: ({ row }) => (
      <span className="text-fg-muted">
        {row.original.kind === "shared" ? "Shared" : "Personal"}
      </span>
    ),
  }),
  helper.accessor("memberCount", {
    header: "Members",
    meta: { align: "right", cellClassName: "tabular-nums" },
  }),
  helper.accessor("createdAt", {
    header: "Created",
    enableGlobalFilter: false,
    cell: ({ row }) => <RelativeTime date={row.original.createdAt} />,
  }),
];

export interface AdminWorkspacesTableProps {
  readonly workspaces: readonly AdminWorkspaceRow[];
  readonly onOpen: (workspaceId: string) => void;
  readonly onLoadMore?: () => void;
  readonly loadingMore?: boolean;
  readonly emptyState?: ReactNode;
}

/**
 * Every workspace of the app, newest first, from the server a page at a time. A shared
 * workspace without an owner is flagged: open it to assign one.
 */
export function AdminWorkspacesTable({
  workspaces,
  onOpen,
  onLoadMore,
  loadingMore = false,
  emptyState,
}: AdminWorkspacesTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <DataTable
        data={workspaces}
        columns={columns}
        getRowId={(workspace) => workspace.id}
        onRowClick={(workspace) => onOpen(workspace.id)}
        enableGlobalFilter={false}
        enableColumnVisibility={false}
        pageSize={100}
        pageSizeOptions={[100]}
        emptyState={emptyState ?? "No workspaces match."}
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

export interface AdminWorkspaceDetailData {
  readonly id: string;
  readonly name: string;
  readonly kind: "personal" | "shared";
  readonly createdAt: Date | string;
  readonly members: readonly {
    readonly userId: string;
    readonly name: string;
    readonly email: string;
    readonly role: string;
    readonly joinedAt: Date | string;
  }[];
  readonly managerCount: number;
  readonly pendingInvitations: number;
}

export interface AdminWorkspaceDetailProps {
  readonly workspace: AdminWorkspaceDetailData;
  /** Makes a user (a member, or any user by id) the owner; only offered without an owner. */
  readonly onAssignOwner: (userId: string) => Promise<void>;
  readonly onDelete: () => Promise<void>;
  readonly onOpenUser?: (userId: string) => void;
}

/**
 * One workspace in the admin portal: members with roles and pending invitations. A shared
 * workspace without an owner can be given one (a member, or any user by id); a shared
 * workspace can be deleted with its files after a confirmation.
 */
export function AdminWorkspaceDetail({
  workspace,
  onAssignOwner,
  onDelete,
  onOpenUser,
}: AdminWorkspaceDetailProps) {
  const { confirm, dialog } = useConfirm();
  const [userId, setUserId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const shared = workspace.kind === "shared";
  const orphan = shared && workspace.managerCount === 0;

  async function assign(target: string) {
    const member = workspace.members.find((m) => m.userId === target);
    const confirmed = await confirm({
      title: `Make ${member?.name ?? target} the owner?`,
      description: `They can manage the members of ${workspace.name}.`,
      confirmLabel: "Make owner",
    });
    if (!confirmed) return;
    setAssigning(true);
    try {
      await onAssignOwner(target);
      setUserId("");
    } finally {
      setAssigning(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (userId.trim()) void assign(userId.trim());
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-fg">{workspace.name}</h2>
          <p className="text-sm text-fg-muted">
            {shared ? "Shared" : "Personal"} workspace ·{" "}
            {workspace.members.length} members · {workspace.pendingInvitations}{" "}
            pending invitations · created{" "}
            <RelativeTime date={workspace.createdAt} />
          </p>
        </div>
        {shared ? (
          <Button
            variant="danger"
            icon={<Trash2 />}
            onClick={() =>
              void (async () => {
                const confirmed = await confirm({
                  title: `Delete ${workspace.name}?`,
                  description:
                    "Its files, members and invitations are deleted. This cannot be undone.",
                  confirmLabel: "Delete workspace",
                  tone: "danger",
                });
                if (confirmed) await onDelete();
              })()
            }
          >
            Delete workspace
          </Button>
        ) : null}
      </Card>

      {orphan ? (
        <Callout
          tone="warning"
          title="Nobody can manage this workspace"
          description="Its owners were removed. Make a member, or any user by id, its owner."
        />
      ) : null}

      <Card className="p-0">
        <Table aria-label="Members">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {orphan ? (
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {workspace.members.map((member) => (
              <TableRow key={member.userId}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <Avatar name={member.name || member.email} size="sm" />
                    {onOpenUser ? (
                      <Button
                        variant="link"
                        onClick={() => onOpenUser(member.userId)}
                      >
                        {member.name}
                      </Button>
                    ) : (
                      member.name
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-fg-muted">{member.email}</TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell>
                  <RelativeTime date={member.joinedAt} />
                </TableCell>
                {orphan ? (
                  <TableCell className="text-right">
                    <Button
                      size="xs"
                      icon={<UserCog />}
                      disabled={assigning}
                      onClick={() => void assign(member.userId)}
                    >
                      Make owner
                      <span className="sr-only"> {member.name}</span>
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {orphan ? (
        <Card className="p-4">
          <form
            noValidate
            onSubmit={submit}
            className="flex flex-wrap items-end gap-2"
          >
            <Field label="Or make another user the owner (user id)">
              <Input
                className="w-80"
                placeholder="User id from the Users page"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
              />
            </Field>
            <Button type="submit" loading={assigning} disabled={!userId.trim()}>
              Make owner
            </Button>
          </form>
        </Card>
      ) : null}
      {dialog}
    </div>
  );
}

/** Loading placeholder of a workspace page. */
export function AdminWorkspaceDetailSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading workspace"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-20 rounded-lg" />
      <Card className="p-4">
        <SkeletonText lines={4} />
      </Card>
    </div>
  );
}
