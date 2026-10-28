import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  sequentialIds,
  testDb,
} from "../../test/fixtures";
import { FileNotFoundError } from "./domain";
import { readOwnedFile } from "./read-owned-file";
import { storeFile } from "./store-file";

async function storedFile(ownerId: string, idPrefix: string) {
  return storeFile(
    {
      db: testDb(),
      bucket: env.FILES,
      clock: fixedClock(),
      ids: sequentialIds(idPrefix),
    },
    {
      filename: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      ownerUserId: ownerId,
      body: new TextEncoder().encode("notes").buffer as ArrayBuffer,
    }
  );
}

describe("readOwnedFile", () => {
  it("returns the owner's file and its object", async () => {
    const owner = await seedUser();
    const file = await storedFile(owner.id, "cccccccc-0000-4000-8000-");
    const result = await readOwnedFile(
      { db: testDb(), bucket: env.FILES },
      { fileId: file.fileId, ownerUserId: owner.id }
    );
    expect(result.file.filename).toBe("notes.txt");
    expect(await result.object.text()).toBe("notes");
  });

  it("hides other users' files", async () => {
    const owner = await seedUser("Ada Lovelace");
    const stranger = await seedUser("Alan Turing");
    const file = await storedFile(owner.id, "dddddddd-0000-4000-8000-");
    await expect(
      readOwnedFile(
        { db: testDb(), bucket: env.FILES },
        { fileId: file.fileId, ownerUserId: stranger.id }
      )
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("reports a record whose object is gone as not found", async () => {
    const owner = await seedUser("Barbara Liskov");
    const file = await storedFile(owner.id, "eeeeeeee-0000-4000-8000-");
    await env.FILES.delete(file.r2Key);
    await expect(
      readOwnedFile(
        { db: testDb(), bucket: env.FILES },
        { fileId: file.fileId, ownerUserId: owner.id }
      )
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });
});
