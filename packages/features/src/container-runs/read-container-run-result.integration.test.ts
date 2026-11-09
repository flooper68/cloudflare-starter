import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import { seedUser, seedWorkspace } from "../../test/fixtures";
import { readContainerRunResult } from "./read-container-run-result";
import { storeContainerRunResult } from "./store-container-run-result";

describe("readContainerRunResult", () => {
  it("returns the stored digits with a file name", async () => {
    const ada = await seedUser("Ada Read");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-read" });
    const runId = await startRun(actor, 10_000);
    await storeContainerRunResult(containerDeps(), {
      runId,
      pi: "3.1415",
      computeMs: 1,
    });
    const { object, filename } = await readContainerRunResult(
      containerDeps(),
      actor,
      { runId }
    );
    expect(filename).toBe("pi-10000-digits.txt");
    expect(await object.text()).toBe("3.1415\n");
  });

  it("is unavailable before a result is stored and not found in another workspace", async () => {
    const ada = await seedUser("Ada Read None");
    const bob = await seedUser("Bob Read None");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-read-none" });
    const other = await seedWorkspace(bob.id, { id: "ws-cr-read-other" });
    const runId = await startRun(actor);
    await expect(
      readContainerRunResult(containerDeps(), actor, { runId })
    ).rejects.toMatchObject({ code: "CONTAINER_RUN_RESULT_UNAVAILABLE" });
    await storeContainerRunResult(containerDeps(), {
      runId,
      pi: "3.14",
      computeMs: 1,
    });
    await expect(
      readContainerRunResult(containerDeps(), other, { runId })
    ).rejects.toMatchObject({ kind: "not_found" });
  });
});
