import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { rememberUploadCleanup } from "./remember-upload-cleanup";
import { retryFileCleanups } from "./retry-file-cleanups";

describe("retryFileCleanups", () => {
  it("dispatches in bounded keyset pages so one failed prefix cannot starve later targets", async () => {
    const { deps, actor } = await privacyFixture();
    for (let i = 0; i < 51; i++)
      await rememberUploadCleanup(deps, {
        r2Key: `workspaces/${actor.workspaceId}/uploads/${String(i).padStart(3, "0")}`,
        workspaceId: actor.workspaceId,
      });
    expect(await retryFileCleanups(deps, {})).toEqual({ queued: 50 });
    const follow = deps.jobQueue.sent.find(
      (m) => m.envelope.type === "files.retry-cleanup"
    );
    expect(follow).toBeDefined();
    expect(
      await retryFileCleanups(deps, follow?.envelope.data as { cursor: string })
    ).toEqual({ queued: 1 });
  });
});
