import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { pendingFileCleanup } from "./files.schema";
import { rememberUploadCleanup } from "./remember-upload-cleanup";

describe("rememberUploadCleanup", () => {
  it("persists exactly one immediate target without cascading foreign keys", async () => {
    const { deps, actor } = await privacyFixture();
    const input = {
      r2Key: `workspaces/${actor.workspaceId}/uploads/late`,
      workspaceId: actor.workspaceId,
    };
    await rememberUploadCleanup(deps, input);
    await rememberUploadCleanup(deps, input);
    expect(
      await deps.db
        .select()
        .from(pendingFileCleanup)
        .where(eq(pendingFileCleanup.target, input.r2Key))
    ).toHaveLength(1);
  });
});
