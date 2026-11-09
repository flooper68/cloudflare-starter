import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import { addMember, seedUser, seedWorkspace } from "../../test/fixtures";
import { listContainerRuns } from "./list-container-runs";

describe("listContainerRuns", () => {
  it("lists the workspace's runs newest first, never another workspace's", async () => {
    const ada = await seedUser("Ada List");
    const grace = await seedUser("Grace List");
    const bob = await seedUser("Bob List");
    const owner = await seedWorkspace(ada.id, { id: "ws-cr-list" });
    const member = await addMember(owner.workspaceId, grace.id);
    const other = await seedWorkspace(bob.id, { id: "ws-cr-list-other" });
    const older = await startRun(owner, 1000, "2026-10-28T10:00:00.000Z");
    const newer = await startRun(member, 10_000, "2026-10-28T11:00:00.000Z");
    await startRun(other, 1000, "2026-10-28T11:30:00.000Z");

    const listed = await listContainerRuns(containerDeps(), member, {});
    expect(listed.items.map((run) => run.id)).toEqual([newer, older]);
    expect(listed.items[0]?.startedBy?.name).toBe("Grace List");
  });

  it("says the demo is on with what is used today and this hour", async () => {
    const ada = await seedUser("Ada Status");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-status" });
    await startRun(actor, 1000, "2026-11-02T12:05:00.000Z");
    const { status } = await listContainerRuns(
      containerDeps({ at: "2026-11-02T12:30:00.000Z" }),
      actor,
      {}
    );
    expect(status).toEqual({
      availability: { state: "on" },
      dailyCap: 50,
      usedToday: 1,
      hourlyLimit: 5,
      usedThisHour: 1,
      presets: [1000, 10_000, 50_000],
      retentionDays: 7,
    });
  });

  it("says why no run can start: off first, then the daily cap, then the hourly limit", async () => {
    const ada = await seedUser("Ada Why");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-why" });
    const at = "2026-11-03T12:00:00.000Z";
    for (let index = 0; index < 5; index += 1) await startRun(actor, 1000, at);

    const state = async (settings: Parameters<typeof containerDeps>[0]) =>
      (await listContainerRuns(containerDeps(settings), actor, {})).status
        .availability.state;
    expect(await state({ at })).toBe("hourly_limit_reached");
    expect(await state({ at, settings: { dailyCap: 5 } })).toBe(
      "daily_cap_reached"
    );
    expect(await state({ at, settings: { mode: "off", dailyCap: 5 } })).toBe(
      "off"
    );
  });
});
