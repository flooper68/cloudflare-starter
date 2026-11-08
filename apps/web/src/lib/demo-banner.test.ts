import { describe, expect, it } from "vitest";

import {
  DEMO_BANNER_DISMISSED_KEY,
  demoBannerDismissed,
  dismissDemoBanner,
} from "./demo-banner";

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  };
}

describe("demo banner dismissal", () => {
  it("is shown until dismissed, then hidden for the session", () => {
    const store = memoryStore();
    expect(demoBannerDismissed(store)).toBe(false);
    dismissDemoBanner(store);
    expect(store.items.get(DEMO_BANNER_DISMISSED_KEY)).toBe("1");
    expect(demoBannerDismissed(store)).toBe(true);
  });

  it("a new session (empty storage) shows it again", () => {
    expect(demoBannerDismissed(memoryStore())).toBe(false);
  });

  it("shows the banner when storage is unavailable or throws", () => {
    expect(demoBannerDismissed(null)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => dismissDemoBanner(broken)).not.toThrow();
    expect(demoBannerDismissed(broken)).toBe(false);
  });
});
