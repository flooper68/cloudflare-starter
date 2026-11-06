import { describe, expect, it, vi } from "vitest";

import { createConnectivity, trackingFetch } from "./connectivity";

function fakeHost(onLine = true) {
  const handlers: Record<string, () => void> = {};
  return {
    host: {
      navigator: { onLine },
      addEventListener: (type: "online" | "offline", listener: () => void) => {
        handlers[type] = listener;
      },
    },
    fire: (type: "online" | "offline") => handlers[type]?.(),
  };
}

describe("connectivity", () => {
  it("starts from navigator.onLine and follows the browser's events", () => {
    const { host, fire } = fakeHost(false);
    const connectivity = createConnectivity(host);
    const listener = vi.fn();
    connectivity.subscribe(listener);
    expect(connectivity.getSnapshot()).toBe(false);
    fire("online");
    expect(connectivity.getSnapshot()).toBe(true);
    fire("offline");
    expect(connectivity.getSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("goes offline on a network error and back on the next response", async () => {
    const connectivity = createConnectivity(fakeHost().host);
    const failing = trackingFetch(connectivity, async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(failing("/api/trpc")).rejects.toThrow("Failed to fetch");
    expect(connectivity.getSnapshot()).toBe(false);

    // An HTTP error is still a response: the server is reachable.
    const answering = trackingFetch(
      connectivity,
      async () => new Response("", { status: 500 })
    );
    await answering("/api/trpc");
    expect(connectivity.getSnapshot()).toBe(true);
  });

  it("does not count an aborted request as offline", async () => {
    const connectivity = createConnectivity(fakeHost().host);
    const aborted = trackingFetch(connectivity, async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    await expect(aborted("/api/trpc")).rejects.toThrow("aborted");
    expect(connectivity.getSnapshot()).toBe(true);
  });

  it("does not notify when nothing changed", () => {
    const connectivity = createConnectivity(fakeHost().host);
    const listener = vi.fn();
    const unsubscribe = connectivity.subscribe(listener);
    connectivity.reportReached();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
    connectivity.reportUnreachable();
    expect(listener).not.toHaveBeenCalled();
  });
});
