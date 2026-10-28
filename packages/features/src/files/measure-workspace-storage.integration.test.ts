import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testBilling,
  testDb,
} from "../../test/fixtures";
import { createFileRecord } from "./create-file-record";
import { measureWorkspaceStorage } from "./measure-workspace-storage";

describe("measureWorkspaceStorage", () => {
  it("sums the sizes of the workspace's files, zero without any", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id, { id: "ws-bytes" });
    const deps = {
      db: testDb(),
      clock: fixedClock(),
      ids: sequentialIds(),
      billing: testBilling(),
    };
    expect(
      await measureWorkspaceStorage(deps, { workspaceId: "ws-bytes" })
    ).toBe(0);
    for (const sizeBytes of [2048, 4096]) {
      await createFileRecord(deps, actor, {
        filename: "roadmap.pdf",
        mimeType: "application/pdf",
        sizeBytes,
      });
    }
    expect(
      await measureWorkspaceStorage(deps, { workspaceId: "ws-bytes" })
    ).toBe(6144);
  });
});
