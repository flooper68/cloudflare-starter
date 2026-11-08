import {
  Button,
  Card,
  DataState,
  EmptyState,
  NoteEditor,
  NoteList,
  NoteListSkeleton,
  SearchInput,
} from "@cloudflare-starter/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { NotebookPen, Plus, SearchX } from "lucide-react";
import { useEffect, useState } from "react";

import { BillingLimitPrompt } from "@/components/app/billing/BillingLimitPrompt";
import { useWorkspace } from "@/components/shared/spa/workspace-context";
import { type LimitRefusal, limitRefusalOf } from "@/lib/billing-prompts";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

import { PlaceholderHeader } from "./PlaceholderHeader";

/** Waits until typing pauses before searching. */
function useDebounced(value: string, ms = 250): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * `/app/notes`: the placeholder Notes app's list. The four data states through
 * DataState, a title search, "New note" inline, and the upgrade prompt when the plan's
 * `notes` limit refuses a new one. The worked example of a feature added end to end
 * (docs/guides/how-to-add-a-feature.md).
 */
export function NotesPage() {
  const { active } = useWorkspace();
  const navigate = useNavigate();
  const workspaceId = active?.id ?? "";
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim());
  const [creating, setCreating] = useState(false);
  const [refusal, setRefusal] = useState<LimitRefusal | null>(null);
  // `?new=true` (the command palette's "New note"): open the form, then drop the flag.
  const { new: requestedNew } = useSearch({ strict: false });
  useEffect(() => {
    if (!requestedNew) return;
    setRefusal(null);
    setCreating(true);
    void navigate({ to: "/app/notes", search: {}, replace: true });
  }, [requestedNew, navigate]);
  const notes = useAsync(
    () => trpc.notes.list.query({ workspaceId, query: query || undefined }),
    `notes:${workspaceId}:${query}`
  );

  async function create(draft: { title: string; body: string }) {
    try {
      const created = await trpc.notes.create.mutate({ workspaceId, ...draft });
      setCreating(false);
      await navigate({
        to: "/app/notes/$noteId",
        params: { noteId: created.id },
      });
    } catch (error) {
      const limit = limitRefusalOf(error);
      if (limit) {
        // The prompt replaces the form: the next step is the plan, not a retry.
        setRefusal(limit);
        setCreating(false);
        return;
      }
      throw error;
    }
  }

  const newNote = (
    <Button
      variant="primary"
      icon={<Plus />}
      onClick={() => {
        setRefusal(null);
        setCreating(true);
      }}
    >
      New note
    </Button>
  );

  return (
    <section className="space-y-6">
      <PlaceholderHeader
        title="Notes"
        description={`Shared notes for everyone in ${active?.name ?? "the workspace"}.`}
        actions={creating ? null : newNote}
      />

      {refusal ? <BillingLimitPrompt refusal={refusal} /> : null}

      {creating ? (
        <Card>
          <NoteEditor
            submitLabel="Create note"
            autoFocus
            onSave={create}
            onCancel={() => setCreating(false)}
          />
        </Card>
      ) : null}

      <SearchInput
        aria-label="Search notes"
        placeholder="Search notes"
        value={search}
        onValueChange={setSearch}
        onClear={() => setSearch("")}
        className="max-w-sm"
      />

      <DataState
        status={notes.status}
        data={notes.data}
        error={notes.error}
        onRetry={notes.refetch}
        loading={<NoteListSkeleton />}
        empty={
          query ? (
            <EmptyState
              variant="compact"
              icon={<SearchX />}
              title="No notes match"
              description={`No note title contains "${query}".`}
              primaryAction={
                <Button size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<NotebookPen />}
              title="No notes yet"
              description="Notes you and your workspace write show up here."
              primaryAction={creating ? undefined : newNote}
            />
          )
        }
      >
        {(data) => (
          <NoteList
            notes={data.items.map((note) => ({
              id: note.id,
              title: note.title,
              excerpt: note.excerpt,
              author: (note.updatedBy ?? note.createdBy)?.name ?? null,
              updatedAt: note.updatedAt,
              commentCount: note.commentCount,
            }))}
            onOpen={(noteId) =>
              void navigate({ to: "/app/notes/$noteId", params: { noteId } })
            }
          />
        )}
      </DataState>
    </section>
  );
}
