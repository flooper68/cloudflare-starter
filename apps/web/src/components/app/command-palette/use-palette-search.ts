import { useCallback, useEffect, useState } from "react";

import type {
  PaletteSearchHit,
  PaletteSearchProvider,
} from "./search-providers";

export interface ProviderSearchState {
  readonly status: "idle" | "loading" | "error" | "ready";
  readonly hits: readonly PaletteSearchHit[];
}

const IDLE: ProviderSearchState = { status: "idle", hits: [] };

/** Typing pauses this long before the providers are asked. */
export const PALETTE_SEARCH_DEBOUNCE_MS = 200;

/**
 * Runs every provider for the query: idle below its minimum length, loading from the
 * first keystroke (so "No results" never flashes before the answer), then ready or error.
 * Debounced; a newer query or closing the palette aborts the request in flight, and a
 * late answer to an old query is dropped. `retry` asks the providers again.
 */
export function usePaletteSearch(
  providers: readonly PaletteSearchProvider[],
  query: string,
  workspaceId: string | null
): {
  readonly states: Readonly<Record<string, ProviderSearchState>>;
  readonly retry: () => void;
} {
  const [states, setStates] = useState<
    Readonly<Record<string, ProviderSearchState>>
  >({});
  const [attempt, setAttempt] = useState(0);
  const trimmed = query.trim();

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the search
  useEffect(() => {
    const controller = new AbortController();
    const due = providers.filter(
      (provider) => workspaceId && trimmed.length >= provider.minQueryLength
    );
    setStates(
      Object.fromEntries(
        providers.map((provider) => [
          provider.id,
          due.includes(provider) ? { status: "loading", hits: [] } : IDLE,
        ])
      )
    );
    if (due.length === 0 || !workspaceId) return;
    const timer = setTimeout(() => {
      for (const provider of due) {
        provider
          .search(trimmed, { workspaceId, signal: controller.signal })
          .then((hits) => {
            if (controller.signal.aborted) return;
            setStates((current) => ({
              ...current,
              [provider.id]: { status: "ready", hits },
            }));
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            setStates((current) => ({
              ...current,
              [provider.id]: { status: "error", hits: [] },
            }));
          });
      }
    }, PALETTE_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [providers, trimmed, workspaceId, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { states, retry };
}
