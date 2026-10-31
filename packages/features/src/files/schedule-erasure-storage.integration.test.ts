import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { pendingFileCleanup } from "./files.schema";
import { rememberErasureStorage } from "./remember-erasure-storage";
import { scheduleErasureStorage } from "./schedule-erasure-storage";

describe("scheduleErasureStorage", () => {
  it("persists the full post-deletion window even if queue publication fails", async () => {
    const { deps, person, actor } = await privacyFixture();
    await rememberErasureStorage(deps, {
      userId: person.id,
      workspaceIds: [actor.workspaceId],
    });
    const later = {
      ...deps,
      clock: { now: () => new Date(deps.clock.now().getTime() + 60000) },
      jobQueue: {
        send: async () => {
          throw new Error("queue unavailable");
        },
      },
    };
    await expect(
      scheduleErasureStorage(later, { userId: person.id })
    ).rejects.toThrow("queue unavailable");
    const [intent] = await deps.db
      .select()
      .from(pendingFileCleanup)
      .where(eq(pendingFileCleanup.target, `workspaces/${actor.workspaceId}/`));
    expect(intent?.notBefore.getTime()).toBe(
      later.clock.now().getTime() + 3600000
    );
  });
});
