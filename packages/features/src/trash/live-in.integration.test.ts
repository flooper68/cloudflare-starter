import { describe, expect, it } from "vitest";

import {
  seedUser,
  seedWorkspace,
  storeTestFile,
  testDb,
  trashTestFile,
} from "../../test/fixtures";
import { schema } from "../database";
import { liveIn } from "./live-in";

describe("liveIn", () => {
  it("matches the actor's workspace's rows that are not in the trash", async () => {
    const owner = await seedUser("Ada Lovelace");
    const outsider = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-live-in" });
    const other = await seedWorkspace(outsider.id, { id: "ws-live-in-other" });
    const live = await storeTestFile(actor, "live.txt");
    const trashed = await storeTestFile(actor, "trashed.txt");
    await storeTestFile(other, "theirs.txt");
    await trashTestFile(actor, trashed.fileId);

    const found = await testDb()
      .select({ id: schema.files.id })
      .from(schema.files)
      .where(liveIn(schema.files, actor));
    expect(found).toEqual([{ id: live.fileId }]);
  });
});
