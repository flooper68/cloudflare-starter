import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import { seedUser, seedWorkspace } from "../../test/fixtures";
import { storageReferenceCatalog } from "../storage-reference-catalog";
import { findReferencedContainerRunKeys } from "./find-referenced-container-run-keys";
import { storeContainerRunResult } from "./store-container-run-result";

describe("findReferencedContainerRunKeys", () => {
  it("protects the results runs reference; a result without its run is an orphan", async () => {
    const ada = await seedUser("Ada Keys");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-keys" });
    const runId = await startRun(actor);
    const { key } = await storeContainerRunResult(containerDeps(), {
      runId,
      pi: "3.14",
      computeMs: 1,
    });
    const orphan =
      "workspaces/ws-cr-gone/container-runs/0b6a3b57-6c3a-4a51-9c71-7a4b8b1f0c11.txt";

    const found = await findReferencedContainerRunKeys(containerDeps(), [
      key,
      orphan,
    ]);
    expect([...found]).toEqual([key]);

    // The reconciliation recognizes the namespace (and leaves unknown ones alone).
    const source = storageReferenceCatalog(containerDeps()).find((entry) =>
      entry.matches(orphan)
    );
    expect(source).toBeDefined();
    expect([...((await source?.referenced([key, orphan])) ?? [])]).toEqual([
      key,
    ]);
  });
});
