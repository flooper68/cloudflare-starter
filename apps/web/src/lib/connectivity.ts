/**
 * Whether the app can reach its server, for the shell's offline notice: offline when the
 * browser says so (`navigator.onLine`, the `offline` event) or when a request to the app
 * failed before any response (a network error, not an HTTP error); online again on the
 * `online` event or the next request that gets any response.
 */
export interface Connectivity {
  readonly online: boolean;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => boolean;
  /** A request got a response (any status): the server is reachable. */
  readonly reportReached: () => void;
  /** A request failed with a network error. */
  readonly reportUnreachable: () => void;
}

export interface ConnectivityHost {
  readonly navigator?: { readonly onLine: boolean };
  addEventListener?: (type: "online" | "offline", listener: () => void) => void;
}

export function createConnectivity(host: ConnectivityHost): Connectivity {
  let browserOnline = host.navigator?.onLine ?? true;
  let reachable = true;
  const listeners = new Set<() => void>();
  let snapshot = browserOnline && reachable;
  const update = () => {
    const next = browserOnline && reachable;
    if (next === snapshot) return;
    snapshot = next;
    for (const listener of listeners) listener();
  };
  host.addEventListener?.("online", () => {
    browserOnline = true;
    reachable = true;
    update();
  });
  host.addEventListener?.("offline", () => {
    browserOnline = false;
    update();
  });
  return {
    get online() {
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    reportReached() {
      reachable = true;
      update();
    },
    reportUnreachable() {
      reachable = false;
      update();
    },
  };
}

/** A network error from `fetch` (no response at all), as opposed to an aborted request. */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

/**
 * `fetch` that reports to `connectivity`: any response counts as reached, a network
 * error as unreachable (and is rethrown). Aborted requests report nothing.
 */
export function trackingFetch(
  connectivity: Pick<Connectivity, "reportReached" | "reportUnreachable">,
  inner: typeof fetch
): typeof fetch {
  return async (input, init) => {
    try {
      const response = await inner(input, init);
      connectivity.reportReached();
      return response;
    } catch (error) {
      if (isNetworkError(error)) connectivity.reportUnreachable();
      throw error;
    }
  };
}

/** The browser's connectivity, shared by the tRPC client and the shell. */
export const connectivity: Connectivity = createConnectivity(
  typeof window === "undefined" ? {} : window
);
