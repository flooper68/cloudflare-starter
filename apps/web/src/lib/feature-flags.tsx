/**
 * Feature flags in the browser: `FeatureFlagsProvider` loads the caller's client flags once
 * (`flags.client`), `useFlag(key)` reads one, `<FlagGate flag>` renders its children only
 * when a boolean flag is on. Only flags marked `client: true` in the catalog
 * (packages/features/src/feature-flags/domain/catalog.ts) reach the browser. Until they
 * load, and if loading fails, every flag has its catalog default, as on the server when the
 * provider fails. Keys are string literals (lint rule flag-key-literal).
 * Guide: docs/guides/how-to-use-feature-flags.md
 */
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { useWorkspace } from "@/components/shared/spa/workspace-context";
import {
  CLIENT_FLAG_DEFAULTS,
  type ClientFlags,
} from "@/lib/client-flag-defaults";
import { trpc } from "@/lib/trpc/client";

export type { ClientFlags } from "@/lib/client-flag-defaults";
export type ClientFlagKey = keyof ClientFlags;
type BooleanFlagKey = {
  [K in ClientFlagKey]: ClientFlags[K] extends boolean ? K : never;
}[ClientFlagKey];

interface FlagsState {
  /** "default": catalog defaults (loading, or the request failed); "loaded": the caller's. */
  readonly source: "default" | "loaded";
  readonly flags: ClientFlags;
}

const FlagsContext = createContext<FlagsState | null>(null);

/**
 * Loads the client flags for the signed-in user in the active workspace and shares them
 * below it; loads again when the active workspace changes. Needs a WorkspaceProvider above.
 */
export function FeatureFlagsProvider({
  children,
  initial,
}: {
  readonly children: ReactNode;
  /** Known values (tests, stories): skips the request. */
  readonly initial?: ClientFlags;
}) {
  const [state, setState] = useState<FlagsState>(
    initial
      ? { source: "loaded", flags: initial }
      : { source: "default", flags: CLIENT_FLAG_DEFAULTS }
  );
  const workspaceId = useWorkspace().active?.id;
  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    trpc.flags.client
      .query({ workspaceId })
      .then((result) => {
        if (!cancelled) setState({ source: "loaded", flags: result.flags });
      })
      .catch((error: unknown) => {
        // Keep the catalog defaults; the server already reported its own failures.
        console.warn(
          "Feature flags could not be loaded; using defaults",
          error
        );
      });
    return () => {
      cancelled = true;
    };
  }, [initial, workspaceId]);
  return (
    <FlagsContext.Provider value={state}>{children}</FlagsContext.Provider>
  );
}

/** A client flag's value: the caller's once loaded, the catalog default before that. */
export function useFlag<K extends ClientFlagKey>(key: K): ClientFlags[K] {
  const state = useContext(FlagsContext);
  if (!state) throw new Error("useFlag needs a FeatureFlagsProvider above it");
  return state.flags[key];
}

/** Renders `children` when the boolean client flag is on, `fallback` (default nothing) when off. */
export function FlagGate({
  flag,
  children,
  fallback = null,
}: {
  readonly flag: BooleanFlagKey;
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}) {
  return useFlag(flag) === true ? children : fallback;
}
