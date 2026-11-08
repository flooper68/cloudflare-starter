import { Badge, PlaceholderNotice } from "@cloudflare-starter/ui";
import type { ReactNode } from "react";

/** The heading of a placeholder app: its name, the Placeholder badge and the notice. */
export function PlaceholderHeader({
  title,
  description,
  notice,
  actions,
}: {
  readonly title: string;
  readonly description: string;
  /** Replaces the notice's default text. */
  readonly notice?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-fg">{title}</h2>
            <Badge tone="info">Placeholder</Badge>
          </div>
          <p className="text-sm text-fg-muted">{description}</p>
        </div>
        {actions}
      </div>
      <PlaceholderNotice>{notice}</PlaceholderNotice>
    </div>
  );
}
