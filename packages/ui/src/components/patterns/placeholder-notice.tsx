import { Puzzle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export interface PlaceholderNoticeProps {
  /** What the placeholder shows, one line. */
  readonly children?: ReactNode;
  readonly className?: string;
}

/**
 * The dashed strip at the top of a placeholder app (Notes, Tasks): it marks the module as
 * an example of where a project's own product goes, not part of the product.
 */
export function PlaceholderNotice({
  children = "An example module that shows where a project's own feature lives. Keep the shell, the four data states, the permission checks, the audit events and the MCP tools; replace the content.",
  className,
}: PlaceholderNoticeProps) {
  return (
    <aside
      aria-label="Placeholder app"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-dashed border-info/60 bg-info-subtle px-3.5 py-2.5 text-sm",
        className
      )}
    >
      <Puzzle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
      <div className="min-w-0">
        <p className="font-medium text-fg">
          Placeholder · your product goes here
        </p>
        <p className="text-fg-muted">{children}</p>
      </div>
    </aside>
  );
}
