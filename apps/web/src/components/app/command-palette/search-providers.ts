/**
 * The command palette's search providers: one per feature whose records the palette
 * finds, each shown as its own group between Navigate and Workspaces, in this order.
 * A new feature adds an entry here (docs/guides/how-to-add-a-feature.md, "Searching from
 * the command palette"): a `workspaceProcedure` query that returns a few live rows of the
 * caller's workspace, and the route a hit opens. The palette debounces the query, cancels
 * stale requests and shows each provider's loading, error and no-match states.
 */
import { trpc } from "@/lib/trpc/client";
import { clientCan } from "@/lib/workspace-permissions";
import type { NavContext, NavIcon } from "../navigation";

/** Kinds of palette items, as the `app.command_palette_item_selected` event reports them. */
export type PaletteItemKind = "navigate" | "note" | "workspace" | "action";

/** One hit of a provider: what the palette shows and the SPA route it opens. */
export interface PaletteSearchHit {
  readonly id: string;
  readonly label: string;
  /** Muted text after the label (an excerpt), short. */
  readonly hint?: string;
  /** An SPA path ("/app/notes/…"). */
  readonly to: string;
}

export interface PaletteSearchProvider {
  /** Group id, unique among providers. */
  readonly id: string;
  /** Group heading ("Notes"); also names the states ("Searching notes…"). */
  readonly heading: string;
  /** Reported when a hit is picked; add a new kind to COMMAND_PALETTE_ITEM_KINDS. */
  readonly kind: Exclude<PaletteItemKind, "navigate" | "workspace" | "action">;
  readonly icon: NavIcon;
  /** Fewer characters do not search (each keystroke would otherwise query). */
  readonly minQueryLength: number;
  /** Who may search it: the read permission of the feature. */
  readonly visible: (context: NavContext) => boolean;
  readonly search: (
    query: string,
    options: { readonly workspaceId: string; readonly signal: AbortSignal }
  ) => Promise<readonly PaletteSearchHit[]>;
}

/** Hits each provider asks for; the server caps it too. */
export const PALETTE_SEARCH_LIMIT = 8;

const HINT_MAX = 48;

function shortHint(text: string): string | undefined {
  if (!text) return undefined;
  return text.length > HINT_MAX ? `${text.slice(0, HINT_MAX - 1)}…` : text;
}

export const paletteSearchProviders: readonly PaletteSearchProvider[] = [
  {
    id: "notes",
    heading: "Notes",
    kind: "note",
    icon: "notes",
    minQueryLength: 2,
    visible: (context) => clientCan(context.workspace?.role, "notes.read"),
    search: async (query, { workspaceId, signal }) => {
      const { items } = await trpc.notes.search.query(
        { workspaceId, query, limit: PALETTE_SEARCH_LIMIT },
        { signal }
      );
      return items.map((note) => ({
        id: note.id,
        label: note.title,
        hint: shortHint(note.excerpt),
        to: `/app/notes/${note.id}`,
      }));
    },
  },
];
