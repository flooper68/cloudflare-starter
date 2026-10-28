import type { DataStatus } from "@cloudflare-starter/ui";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  readonly status: DataStatus;
  readonly data: T | undefined;
  readonly error: unknown;
  /** Loads again; the previous data stays visible until the new result arrives. */
  readonly refetch: () => Promise<void>;
}

/**
 * Runs `load` when `key` changes (encode what `load` reads, e.g. the workspace id) and
 * tracks it in the shape `DataState` takes. A small stand-in for a query library: no
 * cache, no deduplication.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  key: string
): AsyncState<T> {
  const [state, setState] = useState<Omit<AsyncState<T>, "refetch">>({
    status: "pending",
    data: undefined,
    error: undefined,
  });
  const latest = useRef(load);
  latest.current = load;
  // Only the newest request may set state: after a workspace switch, a slower answer
  // for the previous workspace is dropped.
  const generation = useRef(0);

  const refetch = useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    try {
      const data = await latest.current();
      if (mine === generation.current) {
        setState({ status: "success", data, error: undefined });
      }
    } catch (error) {
      if (mine === generation.current) {
        setState((current) => ({ ...current, status: "error", error }));
      }
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the reload trigger
  useEffect(() => {
    setState((current) => ({ ...current, status: "pending" }));
    void refetch();
  }, [key, refetch]);

  return { ...state, refetch };
}
