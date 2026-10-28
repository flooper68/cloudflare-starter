import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  sequentialIds,
  testDb,
} from "../../test/fixtures";
import { createFileRecord } from "./create-file-record";
import { listOwnedFiles } from "./list-owned-files";

describe("listOwnedFiles", () => {
  it("lists only the owner's files, newest first, up to the limit", async () => {
    const owner = await seedUser();
    const other = await seedUser("Alan Turing");
    const ids = sequentialIds();
    const record = (name: string, ownerUserId: string) =>
      createFileRecord(
        { db: testDb(), clock: fixedClock(), ids },
        { filename: name, mimeType: "text/plain", sizeBytes: 1, ownerUserId }
      );
    await record("first.txt", owner.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await record("second.txt", owner.id);
    await record("theirs.txt", other.id);

    const all = await listOwnedFiles(
      { db: testDb() },
      { ownerUserId: owner.id }
    );
    expect(all.map((file) => file.filename)).toEqual([
      "second.txt",
      "first.txt",
    ]);
    expect(all[0]).toMatchObject({ contentType: "text/plain", sizeBytes: 1 });
    expect(Number.isNaN(Date.parse(all[0]?.createdAt ?? ""))).toBe(false);

    const limited = await listOwnedFiles(
      { db: testDb() },
      { ownerUserId: owner.id, limit: 1 }
    );
    expect(limited).toHaveLength(1);
  });
});
