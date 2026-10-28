import { describe, expect, it } from "vitest";

import {
  addMember,
  seedUser,
  seedWorkspace,
  useCaseDeps,
} from "../../test/fixtures";
import { identifyMember } from "./identify-member";

describe("identifyMember", () => {
  it("sends the member's role and the workspace's size bucket, keyed to that workspace", async () => {
    const ada = await seedUser("Ada Lovelace");
    const grace = await seedUser("Grace Hopper");
    const owner = await seedWorkspace(ada.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", grace.id);
    const deps = useCaseDeps();

    await identifyMember(deps, owner);
    await identifyMember(deps, member);

    expect(
      deps.analytics.recorded.map((call) => ({
        event: call.event,
        properties: call.properties,
        userId: call.context.userId,
        workspaceId: call.context.workspaceId,
      }))
    ).toEqual([
      {
        event: "$identify",
        properties: { role: "owner", workspace_size: "2-5", plan: null },
        userId: ada.id,
        workspaceId: "ws-acme",
      },
      {
        event: "$identify",
        properties: { role: "member", workspace_size: "2-5", plan: null },
        userId: grace.id,
        workspaceId: "ws-acme",
      },
    ]);
  });

  it("drops the identify call, without throwing, when the count fails", async () => {
    const deps = useCaseDeps();
    const failing = {
      ...deps,
      db: {
        select: () => {
          throw new Error("D1 unavailable");
        },
      } as unknown as typeof deps.db,
    };
    await expect(
      identifyMember(failing, {
        userId: "user-x",
        workspaceId: "ws-x",
        role: "owner",
      })
    ).resolves.toBeUndefined();
    expect(deps.analytics.recorded).toEqual([]);
  });
});
