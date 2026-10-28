import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  addMember,
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  storeTestFile,
  testDb,
  trashTestFile,
} from "../../test/fixtures";
import { ActionNotAllowedError } from "../workspaces";
import { createDownloadUrl } from "./create-download-url";
import { FileNotFoundError } from "./domain";
import { findWorkspaceFile } from "./find-workspace-file";
import { listWorkspaceFiles } from "./list-workspace-files";
import { readWorkspaceFile } from "./read-workspace-file";

const r2 = {
  accountId: "0123456789abcdef0123456789abcdef",
  filesBucketName: "files",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
};

describe("trashFile", () => {
  it("hides the file from every read path but keeps its object, and records the event", async () => {
    const owner = await seedUser("Ada Lovelace");
    const actor = await seedWorkspace(owner.id, { id: "ws-trash-file" });
    const kept = await storeTestFile(actor, "kept.txt");
    const file = await storeTestFile(actor, "roadmap.txt");

    const trashed = await trashTestFile(
      actor,
      file.fileId,
      "2026-10-01T09:00:00.000Z"
    );
    expect(trashed).toEqual({
      type: "file",
      id: file.fileId,
      deletedAt: "2026-10-01T09:00:00.000Z",
      purgeAt: "2026-10-31T09:00:00.000Z",
    });

    const db = testDb();
    expect(
      (await listWorkspaceFiles({ db }, actor, {})).map((f) => f.id)
    ).toEqual([kept.fileId]);
    await expect(
      findWorkspaceFile({ db }, actor, { fileId: file.fileId })
    ).rejects.toThrow(FileNotFoundError);
    await expect(
      readWorkspaceFile({ db, bucket: env.FILES }, actor, {
        fileId: file.fileId,
      })
    ).rejects.toThrow(FileNotFoundError);
    await expect(
      createDownloadUrl({ db, r2 }, actor, { fileId: file.fileId })
    ).rejects.toThrow(FileNotFoundError);
    // Restorable: the object stays in R2 until the purge.
    expect(await env.FILES.head(file.r2Key)).not.toBeNull();
    expect(
      await rows(
        "SELECT deleted_by FROM files WHERE id = ? AND deleted_at IS NOT NULL",
        file.fileId
      )
    ).toEqual([{ deleted_by: owner.id }]);

    expect(await auditTrail("ws-trash-file")).toEqual([
      {
        action: "trash.item_trashed",
        actor: owner.id,
        target: `file:${file.fileId}`,
        metadata: { entityType: "file" },
      },
    ]);
  });

  it("lets members trash files; a file already in the trash or elsewhere is not found", async () => {
    const owner = await seedUser("Grace Hopper");
    const colleague = await seedUser("Alan Turing");
    const outsider = await seedUser("Ken Thompson");
    const actor = await seedWorkspace(owner.id, { id: "ws-trash-members" });
    const member = await addMember("ws-trash-members", colleague.id);
    const other = await seedWorkspace(outsider.id, { id: "ws-trash-other" });
    const file = await storeTestFile(actor);

    await expect(trashTestFile(other, file.fileId)).rejects.toThrow(
      FileNotFoundError
    );
    await trashTestFile(member, file.fileId);
    await expect(trashTestFile(actor, file.fileId)).rejects.toThrow(
      FileNotFoundError
    );
    await expect(trashTestFile(actor, "no-such-file")).rejects.toThrow(
      FileNotFoundError
    );
  });

  it("refuses a role without files.delete", async () => {
    const owner = await seedUser("Barbara Liskov");
    const actor = await seedWorkspace(owner.id, { id: "ws-trash-role" });
    const file = await storeTestFile(actor);
    await expect(
      trashTestFile(
        { ...actor, role: "viewer" as unknown as typeof actor.role },
        file.fileId
      )
    ).rejects.toThrow(ActionNotAllowedError);
  });
});
