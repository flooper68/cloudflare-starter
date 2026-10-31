import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  DataState,
  EmptyState,
  SkeletonListRow,
  toast,
} from "@cloudflare-starter/ui";
import { FileText, Trash2 } from "lucide-react";

import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trpc } from "@/lib/trpc/client";
import type { AsyncState } from "@/lib/use-async";

export interface WorkspaceFileItem {
  readonly id: string;
  readonly filename: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

/**
 * The active workspace's files: every member sees and opens the same list. "Move to trash"
 * takes a file out at once, with an undo in the toast; the trash page restores it later.
 */
export function WorkspaceFiles({
  files,
}: {
  readonly files: AsyncState<{ readonly items: readonly WorkspaceFileItem[] }>;
}) {
  const { active } = useWorkspace();
  const workspaceId = active?.id ?? "";
  const query = new URLSearchParams({ workspaceId });

  async function moveToTrash(file: WorkspaceFileItem) {
    try {
      await trpc.storage.deleteFile.mutate({ workspaceId, fileId: file.id });
      await files.refetch();
      toast.success(`Moved ${file.filename} to the trash`, {
        action: {
          label: "Undo",
          onClick: () => void undo(file),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  async function undo(file: WorkspaceFileItem) {
    try {
      await trpc.trash.restore.mutate({
        workspaceId,
        items: [{ type: "file", id: file.id }],
      });
      await files.refetch();
      toast.success(`Restored ${file.filename}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed");
    }
  }

  return (
    <Card className="space-y-4">
      <div className="space-y-2">
        <CardTitle>Files in {active?.name}</CardTitle>
        <CardDescription>
          Files belong to the workspace, not to whoever uploaded them: every
          member sees this list.
        </CardDescription>
      </div>
      <DataState
        status={files.status}
        data={files.data}
        error={files.error}
        onRetry={files.refetch}
        loading={
          <div role="status" aria-label="Loading files">
            <SkeletonListRow />
            <SkeletonListRow />
          </div>
        }
        empty={
          <EmptyState
            variant="compact"
            icon={<FileText />}
            title="No files yet"
            description="Upload one above; members of this workspace will see it here."
          />
        }
      >
        {(data) => (
          <ul aria-label="Workspace files" className="divide-y divide-line">
            {data.items.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <a
                  className="truncate font-medium text-accent-text underline-offset-4 hover:underline"
                  href={`/api/files/${file.id}?${query}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  {file.filename}
                </a>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-fg-muted">
                    {(file.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={<Trash2 />}
                    onClick={() => void moveToTrash(file)}
                  >
                    Move to trash
                    <span className="sr-only"> {file.filename}</span>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </Card>
  );
}
