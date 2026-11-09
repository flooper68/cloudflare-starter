import { describe, expect, it } from "vitest";

import { seedUser, testRequestContext, useCaseDeps } from "../../test/fixtures";
import { recordFeatureTried } from "./record-feature-tried";

describe("recordFeatureTried", () => {
  it("sends app.feature_tried once per person and feature", async () => {
    const ada = await seedUser("Ada Tried");
    const deps = useCaseDeps();
    const context = {
      ...testRequestContext({ workspaceId: "ws-1" }),
      userId: ada.id,
    };
    expect(await recordFeatureTried(deps, context, "notes")).toBe(true);
    expect(await recordFeatureTried(deps, context, "notes")).toBe(false);
    expect(await recordFeatureTried(deps, context, "agents")).toBe(true);
    expect(
      deps.analytics.recorded.map((call) => [
        call.event,
        call.properties,
        call.context.userId,
      ])
    ).toEqual([
      ["app.feature_tried", { feature: "notes" }, ada.id],
      ["app.feature_tried", { feature: "agents" }, ada.id],
    ]);
  });
});
