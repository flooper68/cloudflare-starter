import { Download, RefreshCw } from "lucide-react";
import { Badge } from "../badge";
import { Button } from "../button";
import { EmptyState } from "../empty-state";
export interface DataExportItem {
  readonly id: string;
  readonly scope: string;
  readonly status: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly sizeBytes: number | null;
  readonly failure: string | null;
}
export interface DataExportListProps {
  readonly items: readonly DataExportItem[];
  readonly onDownload: (id: string) => void;
  readonly downloadingId?: string | null;
}
/** Status of a person's data exports, including queued, expired and failed requests. */
export function DataExportList({
  items,
  onDownload,
  downloadingId,
}: DataExportListProps) {
  if (!items.length)
    return (
      <EmptyState
        title="No exports yet"
        description="Request an export to download your data. Archives remain available for 24 hours."
      />
    );
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-3 py-3"
        >
          <div className="space-y-1">
            <p className="text-sm font-medium text-fg">
              {item.scope === "workspace"
                ? "Workspace export"
                : "Personal export"}
            </p>
            <p className="text-xs text-fg-muted">
              Requested {new Date(item.createdAt).toLocaleString()}
            </p>
            <Badge>{item.status}</Badge>
            {item.status === "ready" && item.expiresAt && (
              <p className="text-xs text-fg-muted">
                Available until {new Date(item.expiresAt).toLocaleString()}
              </p>
            )}
            {item.status === "failed" && (
              <p className="text-sm text-danger">
                Export could not be completed. Request a new export to try
                again.
              </p>
            )}
            {item.status === "expired" && (
              <p className="text-xs text-fg-muted">
                Request a new export for a fresh download.
              </p>
            )}
            {["queued", "building"].includes(item.status) && (
              <p className="text-xs text-fg-muted">
                You will receive a notification when the archive is ready.
              </p>
            )}
          </div>
          {item.status === "ready" && (
            <Button
              variant="secondary"
              disabled={downloadingId === item.id}
              onClick={() => onDownload(item.id)}
            >
              {downloadingId === item.id ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              Download
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
