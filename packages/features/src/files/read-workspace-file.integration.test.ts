import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  addMember,
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testBilling,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import {
  createMemoryJobQueue,
  createMemoryProductAnalytics,
} from "../platform";
import type { Actor } from "../workspaces";
import { FileNotFoundError } from "./domain";
import { readWorkspaceFile } from "./read-workspace-file";
import { storeFile } from "./store-file";

async function storedFile(actor: Actor, idPrefix: string) {
  return storeFile(
    {
      db: testDb(),
      bucket: env.FILES,
      clock: fixedClock(),
      ids: sequentialIds(idPrefix),
      requestContext: testRequestContext(),
      analytics: createMemoryProductAnalytics(),
      billing: testBilling(),
      jobQueue: createMemoryJobQueue(),
    },
    actor,
    {
      filename: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      body: new TextEncoder().encode("notes").buffer as ArrayBuffer,
    }
  );
}

describe("readWorkspaceFile", () => {
  it("returns the file and its object to a member of the workspace", async () => {
    const owner = await seedUser();
    const colleague = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    const file = await storedFile(actor, "cccccccc-0000-4000-8000-");
    const result = await readWorkspaceFile(
      { db: testDb(), bucket: env.FILES },
      member,
      { fileId: file.fileId }
    );
    expect(result.file.filename).toBe("notes.txt");
    expect(await result.object.text()).toBe("notes");
  });

  it("hides files of other workspaces", async () => {
    const owner = await seedUser("Ada Lovelace");
    const stranger = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-ada" });
    const elsewhere = await seedWorkspace(stranger.id, { id: "ws-alan" });
    const file = await storedFile(actor, "dddddddd-0000-4000-8000-");
    await expect(
      readWorkspaceFile({ db: testDb(), bucket: env.FILES }, elsewhere, {
        fileId: file.fileId,
      })
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("reports a record whose object is gone as not found", async () => {
    const owner = await seedUser("Barbara Liskov");
    const actor = await seedWorkspace(owner.id, { id: "ws-barbara" });
    const file = await storedFile(actor, "eeeeeeee-0000-4000-8000-");
    await env.FILES.delete(file.r2Key);
    await expect(
      readWorkspaceFile({ db: testDb(), bucket: env.FILES }, actor, {
        fileId: file.fileId,
      })
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });
});
