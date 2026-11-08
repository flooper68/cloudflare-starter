import { MessageSquare } from "lucide-react";

import { cn } from "../../lib/utils";
import { Avatar } from "../avatar";
import { List, ListItem } from "../list";
import { Skeleton } from "../skeleton";
import { RelativeTime } from "../timeline";

export interface NoteListItem {
  readonly id: string;
  readonly title: string;
  /** The first line of the body. */
  readonly excerpt: string;
  /** Who changed it last (or wrote it); null once that account is gone. */
  readonly author: string | null;
  readonly updatedAt: Date | string;
  readonly commentCount: number;
}

export interface NoteListProps {
  readonly notes: readonly NoteListItem[];
  /** Click or Enter on a row. */
  readonly onOpen: (id: string) => void;
  readonly label?: string;
  readonly className?: string;
}

/**
 * A workspace's notes, most recently changed first: title, the first line, who changed
 * it and when, and the comment count. Keyboard-navigable (List); Enter opens a note.
 */
export function NoteList({
  notes,
  onOpen,
  label = "Notes",
  className,
}: NoteListProps) {
  return (
    <List
      label={label}
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-surface-raised [&>*:last-child]:border-b-0",
        className
      )}
    >
      {notes.map((note) => (
        <ListItem
          key={note.id}
          leading={<Avatar name={note.author ?? "Deleted account"} size="sm" />}
          title={note.title}
          description={
            <>
              {note.author ?? "Deleted account"} ·{" "}
              <RelativeTime date={note.updatedAt} />
              {note.excerpt ? ` · ${note.excerpt}` : ""}
            </>
          }
          trailing={
            note.commentCount > 0 ? (
              <span className="flex items-center gap-1 text-xs text-fg-muted">
                <MessageSquare aria-hidden="true" className="size-3.5" />
                {note.commentCount}
                <span className="sr-only">
                  {note.commentCount === 1 ? " comment" : " comments"}
                </span>
              </span>
            ) : null
          }
          onSelect={() => onOpen(note.id)}
        />
      ))}
    </List>
  );
}

/** The note list while it loads: rows shaped like the notes. */
export function NoteListSkeleton({ rows = 5 }: { readonly rows?: number }) {
  return (
    <div
      aria-hidden
      className="divide-y divide-line rounded-lg border border-line bg-surface-raised"
    >
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows
        <div key={index} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
