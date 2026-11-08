import type { ReactNode } from "react";

import {
  CommandEmpty,
  CommandError,
  CommandGroup,
  CommandItem,
  CommandLoading,
  CommandNote,
  CommandPalette,
} from "../command-palette";

/** One thing the palette can do: go somewhere, switch, or run an action. */
export interface PaletteCommand {
  /** Unique within its group. */
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  /** Muted text at the end (a section, "Current", an excerpt). */
  readonly hint?: ReactNode;
  /** More words the search matches ("profile" for Account settings). */
  readonly keywords?: readonly string[];
  readonly onSelect: () => void;
}

/** Commands the palette filters itself, as the user types. */
export interface PaletteCommandGroup {
  readonly type: "commands";
  readonly id: string;
  readonly heading: string;
  readonly commands: readonly PaletteCommand[];
}

/** Results of an async search (notes, …): shown as given, with its own states. */
export interface PaletteSearchGroup {
  readonly type: "search";
  readonly id: string;
  readonly heading: string;
  /** `idle` before there is a query long enough to search. */
  readonly status: "idle" | "loading" | "error" | "ready";
  readonly results: readonly PaletteCommand[];
  /** Said while it loads ("Searching notes…"). */
  readonly loadingLabel?: string;
  /** Said when it failed, safe to show ("Couldn't search notes"). */
  readonly errorLabel?: string;
  /** Said when it found nothing while other groups did ("No notes match"). */
  readonly emptyLabel?: string;
  readonly onRetry?: () => void;
}

export type PaletteGroup = PaletteCommandGroup | PaletteSearchGroup;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

/**
 * The commands that match `query`, best first: every word of the query must appear in the
 * label or the keywords (case and accents ignored). Labels that start with the query come
 * first, then labels with a word starting with it, then the rest, each in the given order.
 */
export function filterPaletteCommands(
  commands: readonly PaletteCommand[],
  query: string
): readonly PaletteCommand[] {
  const needle = normalize(query.trim());
  if (needle === "") return commands;
  const words = needle.split(/\s+/);
  const ranked: { command: PaletteCommand; rank: number; index: number }[] = [];
  commands.forEach((command, index) => {
    const label = normalize(command.label);
    const haystack = [label, ...(command.keywords ?? []).map(normalize)].join(
      " "
    );
    if (!words.every((word) => haystack.includes(word))) return;
    const rank = label.startsWith(needle)
      ? 0
      : label.split(/[\s:›/-]+/).some((part) => part.startsWith(words[0] ?? ""))
        ? 1
        : 2;
    ranked.push({ command, rank, index });
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.command);
}

export interface AppCommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The search text (controlled). */
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  /** In display order. Empty command groups and idle search groups are left out. */
  readonly groups: readonly PaletteGroup[];
  readonly placeholder?: string;
  /** Accessible name of the palette. */
  readonly label?: string;
  /** Where focus goes when it closes (usually back to the trigger). */
  readonly onCloseAutoFocus?: (event: Event) => void;
}

/**
 * The app shell's search-and-jump palette: the ⌘K CommandPalette with fixed groups in a
 * fixed order (Navigate, then async search groups such as Notes, then Workspaces and
 * Actions). Command groups are filtered here as the user types; search groups show what
 * their provider returned and their own loading, error and no-match states, outside the
 * listbox. Full screen on phones. The data comes from the app; this only renders it.
 */
export function AppCommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  placeholder = "Search pages, notes and actions…",
  label = "Search and jump",
  onCloseAutoFocus,
}: AppCommandPaletteProps) {
  const shown = groups.map((group) =>
    group.type === "commands"
      ? { group, items: filterPaletteCommands(group.commands, query) }
      : { group, items: group.status === "ready" ? group.results : [] }
  );
  const total = shown.reduce((sum, entry) => sum + entry.items.length, 0);
  const searches = groups.filter(
    (group): group is PaletteSearchGroup => group.type === "search"
  );
  const busy = searches.some(
    (group) => group.status === "loading" || group.status === "error"
  );

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      search={query}
      onSearchChange={onQueryChange}
      shouldFilter={false}
      fullScreenOnMobile
      placeholder={placeholder}
      label={label}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {busy ? null : (
        <CommandEmpty>
          {query.trim() ? `No results for “${query.trim()}”` : "No results"}
        </CommandEmpty>
      )}
      {shown.map(({ group, items }) =>
        items.length > 0 ? (
          <CommandGroup key={group.id} heading={group.heading}>
            {items.map((command) => (
              <CommandItem
                key={command.id}
                value={`${group.id}:${command.id}`}
                icon={command.icon}
                hint={command.hint}
                onSelect={command.onSelect}
              >
                {command.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null
      )}
      {searches.map((group) =>
        group.status === "loading" ? (
          <CommandLoading key={group.id}>
            {group.loadingLabel ?? `Searching ${group.heading.toLowerCase()}…`}
          </CommandLoading>
        ) : group.status === "error" ? (
          <CommandError key={group.id} onRetry={group.onRetry}>
            {group.errorLabel ??
              `Couldn't search ${group.heading.toLowerCase()}`}
          </CommandError>
        ) : group.status === "ready" &&
          group.results.length === 0 &&
          total > 0 ? (
          <CommandNote key={group.id}>
            {group.emptyLabel ?? `No ${group.heading.toLowerCase()} match`}
          </CommandNote>
        ) : null
      )}
    </CommandPalette>
  );
}
