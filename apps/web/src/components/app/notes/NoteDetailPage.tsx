import {
  Button,
  Card,
  CommentComposer,
  CommentThread,
  DataState,
  EmptyState,
  ErrorState,
  NoteEditor,
  RelativeTime,
  SkeletonText,
  toast,
} from "@cloudflare-starter/ui";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/shared/spa/auth-context";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

import { usePageTitle } from "../page-title";

/** No such note here: unknown, trashed, another workspace's, or not a note id at all. */
function isNotFound(error: unknown): boolean {
  const code = (error as { data?: { code?: string } })?.data?.code;
  return code === "NOT_FOUND" || code === "BAD_REQUEST";
}

const back = (
  <Button asChild variant="ghost" size="sm">
    <Link to="/app/notes">
      <ArrowLeft aria-hidden="true" />
      All notes
    </Link>
  </Button>
);

/**
 * `/app/notes/$noteId`: one note of the placeholder Notes app. Read, edit, comment
 * (CommentThread), and move it to the trash with an undo in the toast.
 */
export function NoteDetailPage() {
  const { noteId } = useParams({ from: "/app-layout/app/notes/$noteId" });
  const { active } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const workspaceId = active?.id ?? "";
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const note = useAsync(
    () => trpc.notes.get.query({ workspaceId, noteId }),
    `note:${workspaceId}:${noteId}`
  );
  // The browser tab names the note ("Q3 planning · Starter"), the top bar says "Note".
  usePageTitle(note.data?.title);

  async function moveToTrash(title: string) {
    setDeleting(true);
    try {
      await trpc.notes.delete.mutate({ workspaceId, noteId });
      toast.success(`Moved "${title}" to the trash`, {
        action: { label: "Undo", onClick: () => void undo(title) },
      });
      await navigate({ to: "/app/notes" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function undo(title: string) {
    try {
      await trpc.trash.restore.mutate({
        workspaceId,
        items: [{ type: "note", id: noteId }],
      });
      toast.success(`Restored "${title}"`);
      await navigate({ to: "/app/notes/$noteId", params: { noteId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed");
    }
  }

  return (
    <section className="space-y-6">
      <div>{back}</div>
      <DataState
        status={note.status}
        data={note.data}
        error={note.error}
        onRetry={note.refetch}
        isEmpty={() => false}
        loading={
          <Card className="space-y-4" aria-hidden>
            <SkeletonText lines={1} className="w-1/3" />
            <SkeletonText lines={4} />
          </Card>
        }
        empty={null}
        errorView={(error) =>
          isNotFound(error) ? (
            <EmptyState
              icon={<FileQuestion />}
              title="Note not found"
              description="It was moved to the trash, or it belongs to another workspace."
              primaryAction={
                <Button asChild variant="secondary">
                  <Link to="/app/trash">Open the trash</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Couldn't load the note"
              error={error}
              onRetry={note.refetch}
            />
          )
        }
      >
        {(data) => (
          <div className="space-y-6">
            <Card className="space-y-4">
              {editing ? (
                <NoteEditor
                  defaultValue={{ title: data.title, body: data.body }}
                  onSave={async (draft) => {
                    await trpc.notes.update.mutate({
                      workspaceId,
                      noteId,
                      ...draft,
                    });
                    setEditing(false);
                    await note.refetch();
                    toast.success("Note saved");
                  }}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h2 className="break-words text-xl font-semibold text-fg">
                        {data.title}
                      </h2>
                      <p className="text-xs text-fg-muted">
                        {(data.updatedBy ?? data.createdBy)?.name ??
                          "Deleted account"}{" "}
                        · edited <RelativeTime date={data.updatedAt} />
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        icon={<Pencil />}
                        onClick={() => setEditing(true)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 />}
                        loading={deleting}
                        onClick={() => void moveToTrash(data.title)}
                      >
                        Move to trash
                      </Button>
                    </div>
                  </div>
                  {data.body ? (
                    <p className="whitespace-pre-wrap break-words text-sm text-fg">
                      {data.body}
                    </p>
                  ) : (
                    <p className="text-sm text-fg-muted">No text yet.</p>
                  )}
                </>
              )}
            </Card>

            <Card className="space-y-4">
              <h3 className="text-sm font-medium text-fg">
                Comments
                <span className="sr-only">: {data.comments.length}</span>
              </h3>
              {data.comments.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  No comments yet. Start the conversation below.
                </p>
              ) : null}
              <CommentThread
                comments={data.comments.map((comment) => ({
                  id: comment.id,
                  author: comment.author
                    ? { id: comment.author.userId, name: comment.author.name }
                    : { id: "deleted", name: "Deleted account" },
                  body: comment.body,
                  createdAt: comment.createdAt,
                }))}
                composer={
                  <CommentComposer
                    author={
                      user
                        ? {
                            id: user.id,
                            name: user.name || user.email,
                            avatarUrl: user.image ?? undefined,
                          }
                        : undefined
                    }
                    onSubmit={async (body) => {
                      try {
                        await trpc.notes.comments.add.mutate({
                          workspaceId,
                          noteId,
                          body,
                        });
                        await note.refetch();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Couldn't add the comment"
                        );
                        throw error;
                      }
                    }}
                  />
                }
              />
            </Card>
          </div>
        )}
      </DataState>
    </section>
  );
}
