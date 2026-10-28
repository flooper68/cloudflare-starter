import {
  Card,
  CardDescription,
  CardTitle,
  DataState,
  EmptyState,
  SkeletonListRow,
} from "@cloudflare-starter/ui";
import { FileText } from "lucide-react";

import { useWorkspace } from "@/components/shared/spa/workspace-context";
import type { AsyncState } from "@/lib/use-async";

export interface WorkspaceFileItem {
  readonly id: string;
  readonly filename: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

/** The active workspace's files: every member sees and opens the same list. */
export function WorkspaceFiles({
  files,
}: {
  readonly files: AsyncState<{ readonly items: readonly WorkspaceFileItem[] }>;
}) {
  const { active } = useWorkspace();
  const query = new URLSearchParams({ workspaceId: active?.id ?? "" });

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
                <span className="shrink-0 text-xs text-fg-muted">
                  {(file.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </li>
            ))}
          </ul>
        )}
      </DataState>
    </Card>
  );
}
