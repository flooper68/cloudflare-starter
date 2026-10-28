import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import {
  auditTrail,
  rows,
  seedUser,
  seedWorkspace,
  storeTestFile,
  trashTestFile,
  useCaseDeps,
} from "../../test/fixtures";
import { createMemoryJobQueue } from "../platform";
import { TRASH_CATALOG } from "../trash-catalog";
import { purgeExpiredTrash } from "./purge-expired-trash";

const AS_OF = "2026-10-28T03:17:00.000Z";
// 30 days (files' retention) before AS_OF.
const CUTOFF = "2026-09-28T03:17:00.000Z";

function deps() {
  const jobQueue = createMemoryJobQueue();
  return {
    ...useCaseDeps(),
    bucket: env.FILES,
    jobQueue,
    entities: TRASH_CATALOG,
  };
}

describe("purgeExpiredTrash", () => {
  it("purges items trashed at or before the cutoff in every workspace, as the system", async () => {
    const ada = await seedUser("Ada Lovelace");
    const ken = await seedUser("Ken Thompson");
    const first = await seedWorkspace(ada.id, { id: "ws-expire-a" });
    const second = await seedWorkspace(ken.id, { id: "ws-expire-b" });
    const expired = await storeTestFile(first, "expired.txt");
    const boundary = await storeTestFile(second, "boundary.txt");
    const recent = await storeTestFile(first, "recent.txt");
    const live = await storeTestFile(first, "live.txt");
    await trashTestFile(first, expired.fileId, "2026-08-01T00:00:00.000Z");
    await trashTestFile(second, boundary.fileId, CUTOFF); // exactly due
    await trashTestFile(first, recent.fileId, "2026-09-28T03:17:00.001Z");

    const run = deps();
    expect(await purgeExpiredTrash(run, { asOf: AS_OF })).toEqual({
      purged: 2,
      continued: false,
    });
    expect(await env.FILES.head(expired.r2Key)).toBeNull();
    expect(await env.FILES.head(boundary.r2Key)).toBeNull();
    expect(await env.FILES.head(recent.r2Key)).not.toBeNull();
    expect(await env.FILES.head(live.r2Key)).not.toBeNull();
    expect(
      await rows(
        "SELECT id FROM files WHERE workspace_id = ? ORDER BY id",
        "ws-expire-a"
      )
    ).toEqual(
      [{ id: recent.fileId }, { id: live.fileId }].sort((a, b) =>
        a.id.localeCompare(b.id)
      )
    );
    expect(run.jobQueue.sent).toEqual([]);
    expect((await auditTrail("ws-expire-b")).at(-1)).toEqual({
      action: "trash.item_purged",
      actor: null,
      target: `file:${boundary.fileId}`,
      metadata: { entityType: "file", reason: "retention" },
    });
    expect(
      await rows(
        "SELECT actor_kind FROM audit_events WHERE action = 'trash.item_purged' AND target_id = ?",
        expired.fileId
      )
    ).toEqual([{ actor_kind: "system" }]);

    // A rerun (a retry of the same job) finds nothing more to do.
    expect(await purgeExpiredTrash(deps(), { asOf: AS_OF })).toEqual({
      purged: 0,
      continued: false,
    });
  });

  it("purges 500 per run and enqueues itself with the same asOf until the backlog is gone", async () => {
    const owner = await seedUser("Grace Hopper");
    await seedWorkspace(owner.id, { id: "ws-expire-backlog" });
    const old = Date.parse("2026-01-01T00:00:00.000Z");
    const insert = env.DB.prepare(
      "INSERT INTO files (id, workspace_id, bucket, r2_key, filename, content_type, size_bytes, deleted_at, deleted_by) VALUES (?, 'ws-expire-backlog', 'files', ?, ?, 'text/plain', 1, ?, NULL)"
    );
    await env.DB.batch(
      Array.from({ length: 501 }, (_, index) =>
        insert.bind(
          `backlog-${String(index).padStart(3, "0")}`,
          `workspaces/ws-expire-backlog/uploads/2026/01/backlog-${index}`,
          `scan-${index}.txt`,
          old + index
        )
      )
    );

    const first = deps();
    expect(await purgeExpiredTrash(first, { asOf: AS_OF })).toEqual({
      purged: 500,
      continued: true,
    });
    expect(first.jobQueue.sent.map((sent) => sent.envelope)).toEqual([
      expect.objectContaining({
        type: "trash.purge-expired",
        data: { asOf: AS_OF },
      }),
    ]);
    // Oldest first: the newest one is what is left.
    expect(
      await rows(
        "SELECT id FROM files WHERE workspace_id = ?",
        "ws-expire-backlog"
      )
    ).toEqual([{ id: "backlog-500" }]);

    const second = deps();
    expect(await purgeExpiredTrash(second, { asOf: AS_OF })).toEqual({
      purged: 1,
      continued: false,
    });
    expect(second.jobQueue.sent).toEqual([]);
  });
});
