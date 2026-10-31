import { describe, expect, it } from "vitest";

import {
  seedUser,
  seedWorkspace,
  storeTestFile,
  testDb,
  trashTestFile,
} from "../../test/fixtures";
import { schema } from "../database";
import { trashedIn } from "./trashed-in";

describe("trashedIn", () => {
  it("matches the actor's workspace's rows that are in the trash", async () => {
    const owner = await seedUser("Ada Lovelace");
    const outsider = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-trashed-in" });
    const other = await seedWorkspace(outsider.id, {
      id: "ws-trashed-in-other",
    });
    await storeTestFile(actor, "live.txt");
    const trashed = await storeTestFile(actor, "trashed.txt");
    const theirs = await storeTestFile(other, "theirs.txt");
    await trashTestFile(actor, trashed.fileId);
    await trashTestFile(other, theirs.fileId);

    const found = await testDb()
      .select({ id: schema.files.id })
      .from(schema.files)
      .where(trashedIn(schema.files, actor));
    expect(found).toEqual([{ id: trashed.fileId }]);
  });
});
