import { format } from "date-fns";
import { FileText, RotateCcw, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { useConfirm } from "../alert-dialog";
import { Button } from "../button";
import { DataTable, type DataTableColumnDef } from "../data-table";
import { SkeletonListRow } from "../skeleton";

/** One thing in a workspace's trash, as the app's trash list returns it. */
export interface TrashListItem {
  /** The entity type (`file`); restore and delete name the item by type and id. */
  readonly type: string;
  readonly id: string;
  readonly label: string;
  readonly sizeBytes: number | null;
  /** ISO 8601. */
  readonly deletedAt: string;
  /** Who moved it to the trash; null once their account is gone. */
  readonly deletedByName: string | null;
  /** ISO 8601: when it is deleted for good. */
  readonly purgeAt: string;
}

export interface TrashListProps {
  readonly items: readonly TrashListItem[];
  /** Whether the signed-in user may restore (members and owners). */
  readonly canRestore: boolean;
  /** Whether the signed-in user may delete permanently and empty the trash (owners). */
  readonly canPurge: boolean;
  /** "Now" for the days left; defaults to the current time. */
  readonly now?: Date;
  readonly onRestore?: (item: TrashListItem) => void;
  /** Called after the user confirmed. */
  readonly onDeletePermanently?: (item: TrashListItem) => void;
  /** Called after the user confirmed. */
  readonly onEmpty?: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function daysLeft(purgeAt: string, now: Date): string {
  const days = Math.ceil((Date.parse(purgeAt) - now.getTime()) / DAY_MS);
  if (days <= 0) return "Today";
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * A workspace's trash: what was deleted, by whom, and how long until it is deleted for
 * good. Everyone who may restore gets "Restore"; owners also get "Delete permanently" per
 * item and "Empty trash", both confirmed first. The list only reports intents; the app
 * calls the API, shows its errors and refreshes.
 */
export function TrashList({
  items,
  canRestore,
  canPurge,
  now,
  onRestore,
  onDeletePermanently,
  onEmpty,
}: TrashListProps) {
  const { confirm, dialog } = useConfirm();
  const at = useMemo(() => now ?? new Date(), [now]);

  const columns = useMemo<DataTableColumnDef<TrashListItem>[]>(() => {
    async function deletePermanently(item: TrashListItem) {
      const confirmed = await confirm({
        title: `Delete ${item.label} permanently?`,
        description:
          "It is deleted for good, with its stored data. This cannot be undone.",
        confirmLabel: "Delete permanently",
        tone: "danger",
      });
      if (confirmed) onDeletePermanently?.(item);
    }

    const base: DataTableColumnDef<TrashListItem>[] = [
      {
        id: "label",
        accessorKey: "label",
        header: "Name",
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <FileText aria-hidden className="size-4 shrink-0 text-fg-muted" />
            <span className="truncate font-medium">{row.original.label}</span>
          </span>
        ),
      },
      {
        id: "size",
        accessorFn: (item) => item.sizeBytes ?? 0,
        header: "Size",
        meta: { align: "right", cellClassName: "tabular-nums text-fg-muted" },
        cell: ({ row }) => formatSize(row.original.sizeBytes),
      },
      {
        id: "deletedAt",
        accessorKey: "deletedAt",
        header: "Deleted",
        cell: ({ row }) => (
          <span className="text-fg-muted">
            {format(new Date(row.original.deletedAt), "MMM d, yyyy")}
            {row.original.deletedByName
              ? ` by ${row.original.deletedByName}`
              : null}
          </span>
        ),
      },
      {
        id: "purgeAt",
        accessorKey: "purgeAt",
        header: "Deleted for good in",
        cell: ({ row }) => (
          <span className="tabular-nums text-fg-muted">
            {daysLeft(row.original.purgeAt, at)}
          </span>
        ),
      },
    ];
    if (!canRestore && !canPurge) return base;
    return [
      ...base,
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        enableGlobalFilter: false,
        header: () => <span className="sr-only">Actions</span>,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="flex justify-end gap-1">
            {canRestore ? (
              <Button
                size="xs"
                variant="ghost"
                icon={<RotateCcw />}
                onClick={() => onRestore?.(row.original)}
              >
                Restore<span className="sr-only"> {row.original.label}</span>
              </Button>
            ) : null}
            {canPurge ? (
              <Button
                size="xs"
                variant="ghost"
                icon={<Trash2 />}
                onClick={() => void deletePermanently(row.original)}
              >
                Delete permanently
                <span className="sr-only"> {row.original.label}</span>
              </Button>
            ) : null}
          </span>
        ),
      },
    ];
  }, [at, canPurge, canRestore, confirm, onDeletePermanently, onRestore]);

  async function empty() {
    const count = items.length;
    const confirmed = await confirm({
      title: "Empty trash?",
      description: `${count === 1 ? "1 item is" : `${count} items are`} deleted for good, with their stored data. This cannot be undone.`,
      confirmLabel: "Empty trash",
      tone: "danger",
    });
    if (confirmed) onEmpty?.();
  }

  return (
    <>
      <DataTable
        data={items}
        columns={columns}
        getRowId={(item) => `${item.type}:${item.id}`}
        enableGlobalFilter
        searchPlaceholder="Filter by name…"
        enableColumnVisibility={false}
        toolbar={
          canPurge && items.length > 0 ? (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 />}
              onClick={() => void empty()}
            >
              Empty trash
            </Button>
          ) : null
        }
        emptyState="Nothing matches."
      />
      {dialog}
    </>
  );
}

/** Loading placeholder shaped like the trash list. */
export function TrashListSkeleton({ rows = 3 }: { readonly rows?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading trash"
      className="py-1"
    >
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <SkeletonListRow key={index} />
      ))}
    </div>
  );
}
