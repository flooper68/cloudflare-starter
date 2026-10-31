import { describe, expect, it } from "vitest";
import {
  seedUser,
  seedWorkspace,
  storeTestFile,
  useCaseDeps,
} from "../../test/fixtures";
import { createFileRecord, findReferencedFileKeys, trashFile } from "./index";

describe("findReferencedFileKeys", () => {
  it("protects live, trashed and not-yet-uploaded file rows across workspaces", async () => {
    const user = await seedUser();
    const actor = await seedWorkspace(user.id);
    const deps = useCaseDeps();
    const live = await storeTestFile(actor);
    const trash = await storeTestFile(actor, "trash.txt");
    await trashFile(deps, actor, { fileId: trash.fileId });
    const pending = await createFileRecord(deps, actor, {
      filename: "pending.txt",
      mimeType: "text/plain",
      sizeBytes: 2,
    });
    const keys = [live.r2Key, trash.r2Key, pending.r2Key];
    expect(await findReferencedFileKeys(deps, [...keys, "missing"])).toEqual(
      new Set(keys)
    );
    expect(await findReferencedFileKeys(deps, [])).toEqual(new Set());
  });
});
