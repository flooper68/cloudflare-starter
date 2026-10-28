import { describe, expect, it } from "vitest";

import { createMemoryProductAnalytics } from "../platform";
import { identifyUser } from "./identify-user";

const context = {
  userId: "user-ada",
  workspaceId: "ws-acme",
  environment: "local",
  release: "local",
  source: "http" as const,
};

describe("identifyUser", () => {
  it("sends the catalog traits as $identify", () => {
    const analytics = createMemoryProductAnalytics();
    expect(
      identifyUser({ analytics }, context, {
        role: "owner",
        workspace_size: "2-5",
        plan: null,
      })
    ).toBe(true);
    expect(analytics.recorded).toEqual([
      expect.objectContaining({
        kind: "identify",
        event: "$identify",
        properties: { role: "owner", workspace_size: "2-5", plan: null },
        context,
      }),
    ]);
  });

  it("drops traits outside the catalog and anonymous callers", () => {
    const analytics = createMemoryProductAnalytics();
    expect(
      identifyUser({ analytics }, context, {
        role: "owner",
        workspace_size: "2-5",
        plan: null,
        email: "ada@example.test",
      } as never)
    ).toBe(false);
    expect(
      identifyUser(
        { analytics },
        { ...context, userId: null },
        { role: "owner", workspace_size: "1", plan: null }
      )
    ).toBe(false);
    expect(analytics.recorded).toEqual([]);
  });
});
