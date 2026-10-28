import { describe, expect, it } from "vitest";

import {
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testBilling,
  testDb,
} from "../../test/fixtures";
import type { Actor } from "../workspaces";
import { createFileRecord } from "./create-file-record";
import { listWorkspaceFiles } from "./list-workspace-files";

describe("listWorkspaceFiles", () => {
  it("lists only the workspace's files, newest first, up to the limit", async () => {
    const owner = await seedUser();
    const other = await seedUser("Alan Turing");
    const actor = await seedWorkspace(owner.id, { id: "ws-acme" });
    const elsewhere = await seedWorkspace(other.id, { id: "ws-other" });
    const ids = sequentialIds();
    const record = (name: string, who: Actor) =>
      createFileRecord(
        { db: testDb(), clock: fixedClock(), ids, billing: testBilling() },
        who,
        {
          filename: name,
          mimeType: "text/plain",
          sizeBytes: 1,
        }
      );
    await record("first.txt", actor);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await record("second.txt", actor);
    await record("theirs.txt", elsewhere);

    const all = await listWorkspaceFiles({ db: testDb() }, actor, {});
    expect(all.map((file) => file.filename)).toEqual([
      "second.txt",
      "first.txt",
    ]);
    expect(all[0]).toMatchObject({ contentType: "text/plain", sizeBytes: 1 });
    expect(Number.isNaN(Date.parse(all[0]?.createdAt ?? ""))).toBe(false);

    const limited = await listWorkspaceFiles({ db: testDb() }, actor, {
      limit: 1,
    });
    expect(limited).toHaveLength(1);
  });
});
