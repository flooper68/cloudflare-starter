import { describe, expect, it } from "vitest";

import {
  addMember,
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testDb,
} from "../../test/fixtures";
import { createFileRecord } from "./create-file-record";
import { FileNotFoundError } from "./domain";
import { findWorkspaceFile } from "./find-workspace-file";

describe("findWorkspaceFile", () => {
  it("finds a file for every member of its workspace and hides it from others", async () => {
    const owner = await seedUser();
    const colleague = await seedUser("Grace Hopper");
    const stranger = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const member = await addMember("ws-acme", colleague.id);
    const elsewhere = await seedWorkspace(stranger.id, { id: "ws-other" });
    const { fileId } = await createFileRecord(
      { db: testDb(), clock: fixedClock(), ids: sequentialIds() },
      actor,
      { filename: "plan.md", mimeType: "text/markdown", sizeBytes: 3 }
    );

    expect(
      (await findWorkspaceFile({ db: testDb() }, member, { fileId })).filename
    ).toBe("plan.md");
    await expect(
      findWorkspaceFile({ db: testDb() }, elsewhere, { fileId })
    ).rejects.toBeInstanceOf(FileNotFoundError);
    await expect(
      findWorkspaceFile({ db: testDb() }, actor, { fileId: "missing" })
    ).rejects.toBeInstanceOf(FileNotFoundError);
  });
});
