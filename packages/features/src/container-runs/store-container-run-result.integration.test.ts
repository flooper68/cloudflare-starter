import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { containerDeps, startRun } from "../../test/container-run-fixtures";
import { rows, seedUser, seedWorkspace } from "../../test/fixtures";
import { chudnovskyPi } from "../platform";
import { storeContainerRunResult } from "./store-container-run-result";

describe("storeContainerRunResult", () => {
  it("puts the digits in R2 under the workspace's prefix and keeps a preview in the row", async () => {
    const ada = await seedUser("Ada Store");
    const actor = await seedWorkspace(ada.id, { id: "ws-cr-store" });
    const runId = await startRun(actor, 1000);
    const pi = chudnovskyPi(1000);

    const stored = await storeContainerRunResult(containerDeps(), {
      runId,
      pi,
      computeMs: 612.4,
    });

    const key = `workspaces/ws-cr-store/container-runs/${runId}.txt`;
    expect(stored).toEqual({ key, bytes: 1003 });
    const object = await env.FILES.get(key);
    expect(await object?.text()).toBe(`${pi}\n`);
    expect(object?.httpMetadata?.contentType).toBe("text/plain; charset=utf-8");
    expect(
      await rows(
        "SELECT result_key, result_preview, result_bytes, compute_ms FROM container_runs WHERE id = ?",
        runId
      )
    ).toEqual([
      {
        result_key: key,
        result_preview: pi.slice(0, 102),
        result_bytes: 1003,
        compute_ms: 612,
      },
    ]);

    // A retried step overwrites the same object.
    await storeContainerRunResult(containerDeps(), { runId, pi, computeMs: 1 });
    const listed = await env.FILES.list({
      prefix: "workspaces/ws-cr-store/container-runs/",
    });
    expect(listed.objects.map((o) => o.key)).toEqual([key]);
  });

  it("refuses a run that is gone", async () => {
    await expect(
      storeContainerRunResult(containerDeps(), {
        runId: "00000000-0000-4000-8000-00000000beef",
        pi: "3.14",
        computeMs: 1,
      })
    ).rejects.toMatchObject({ kind: "not_found" });
  });
});
