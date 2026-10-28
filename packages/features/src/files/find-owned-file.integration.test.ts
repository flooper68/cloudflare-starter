import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  sequentialIds,
  testDb,
} from "../../test/fixtures";
import { createFileRecord } from "./create-file-record";
import { FileNotFoundError } from "./domain";
import { findOwnedFile } from "./find-owned-file";

describe("findOwnedFile", () => {
  it("finds the owner's file and hides it from everyone else", async () => {
    const owner = await seedUser();
    const stranger = await seedUser("Alan Turing");
    const { fileId } = await createFileRecord(
      { db: testDb(), clock: fixedClock(), ids: sequentialIds() },
      {
        filename: "plan.md",
        mimeType: "text/markdown",
        sizeBytes: 3,
        ownerUserId: owner.id,
      }
    );

    expect(
      (await findOwnedFile({ db: testDb() }, { fileId, ownerUserId: owner.id }))
        .filename
    ).toBe("plan.md");
    await expect(
      findOwnedFile({ db: testDb() }, { fileId, ownerUserId: stranger.id })
    ).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(
      findOwnedFile(
        { db: testDb() },
        { fileId: "missing", ownerUserId: owner.id }
      )
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });
});
