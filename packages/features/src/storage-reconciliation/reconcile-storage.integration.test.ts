import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  rows,
  seedUser,
  seedWorkspace,
  storeTestFile,
  trashTestFile,
  useCaseDeps,
} from "../../test/fixtures";
import {
  createMemoryLogger,
  fileTrash,
  purgeItems,
  storageReferenceCatalog,
} from "../index";
import type { ReconciliationInput } from "./domain";
import { reconcileStorage } from "./reconcile-storage";

function setup(mode: "report" | "delete" = "report") {
  const deps = {
    ...useCaseDeps(),
    bucket: env.FILES,
    logger: createMemoryLogger(),
    storageReconcile: mode,
    references: storageReferenceCatalog(useCaseDeps()),
  };
  const input: ReconciliationInput = {
    runId: crypto.randomUUID(),
    mode,
    trigger: "manual",
    asOf: new Date(Date.now() + 2 * 86400000).toISOString(),
    prefix: "workspaces/",
  };
  return { deps, input };
}
const orphan = "workspaces/missing/uploads/2026/10/orphan";
describe("reconcileStorage", () => {
  beforeEach(async () => {
    await env.DB.exec(
      "DELETE FROM files; DELETE FROM workspace_members; DELETE FROM workspaces; DELETE FROM user; DELETE FROM audit_events;"
    );
    const page = await env.FILES.list();
    if (page.objects.length)
      await env.FILES.delete(page.objects.map((x) => x.key));
  });
  it("reports old orphans, protects live/trashed files and unknown namespaces, and never deletes in report mode", async () => {
    const { deps, input } = setup();
    const actor = await seedWorkspace((await seedUser()).id);
    const live = await storeTestFile(actor);
    const trashed = await storeTestFile(actor, "trashed.txt");
    await trashTestFile(actor, trashed.fileId);
    await env.FILES.put(orphan, "leftover");
    await env.FILES.put("workspaces/missing/private-application-data", "keep");
    const result = await reconcileStorage(deps, input);
    expect(result).toMatchObject({ orphaned: 1, deleted: 0, continued: true });
    expect(await env.FILES.head(orphan)).not.toBeNull();
    expect(await env.FILES.head(live.r2Key)).not.toBeNull();
    expect(await env.FILES.head(trashed.r2Key)).not.toBeNull();
    expect(deps.jobQueue.sent[0]?.envelope.data).toMatchObject({
      prefix: "users/",
      asOf: input.asOf,
      mode: "report",
    });
    expect(
      await rows(
        "SELECT action FROM audit_events WHERE action = 'storage.reconciliation_page'"
      )
    ).toHaveLength(1);
  });
  it("cleans an orphan left by failed R2 deletion during purge and is safe on retry", async () => {
    const { deps, input } = setup("delete");
    const actor = await seedWorkspace((await seedUser()).id);
    const file = await storeTestFile(actor);
    await trashTestFile(actor, file.fileId);
    const broken = new Proxy(env.FILES, {
      get(target, property) {
        if (property === "delete")
          return async () => {
            throw new Error("R2 unavailable");
          };
        const v = Reflect.get(target, property, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    await expect(
      purgeItems({ ...deps, bucket: broken, entities: [fileTrash] }, actor, {
        items: [{ type: "file", id: file.fileId }],
      })
    ).rejects.toThrow("R2 unavailable");
    expect(await env.FILES.head(file.r2Key)).not.toBeNull();
    expect(
      await rows(
        "SELECT action FROM audit_events WHERE action = 'trash.item_purged' AND target_id = ?",
        file.fileId
      )
    ).toHaveLength(1);
    expect(await reconcileStorage(deps, input)).toMatchObject({ deleted: 1 });
    expect(await env.FILES.head(file.r2Key)).toBeNull();
    expect(await reconcileStorage(deps, input)).toMatchObject({ deleted: 0 });
  });
  it("keeps new objects even when their reference has not been written", async () => {
    const { deps, input } = setup("delete");
    await env.FILES.put(orphan, "fresh");
    expect(
      await reconcileStorage(deps, { ...input, asOf: new Date().toISOString() })
    ).toMatchObject({ orphaned: 0, deleted: 0 });
    expect(await env.FILES.head(orphan)).not.toBeNull();
  });
  it("fails closed if any reference lookup fails", async () => {
    const { deps, input } = setup("delete");
    await env.FILES.put(orphan, "leftover");
    await expect(
      reconcileStorage(
        {
          ...deps,
          references: [
            {
              matches: () => true,
              referenced: async () => {
                throw new Error("D1 unavailable");
              },
            },
          ],
        },
        input
      )
    ).rejects.toThrow("D1 unavailable");
    expect(await env.FILES.head(orphan)).not.toBeNull();
    expect(deps.jobQueue.sent).toHaveLength(0);
  });
  it("follows a truncated short page's opaque cursor and keeps the cutoff", async () => {
    const { deps, input } = setup();
    const list = vi.fn().mockResolvedValue({
      objects: [],
      truncated: true,
      cursor: "opaque-next",
      delimitedPrefixes: [],
    });
    const bucket = new Proxy(env.FILES, {
      get(target, key) {
        if (key === "list") return list;
        const v = Reflect.get(target, key, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    expect(await reconcileStorage({ ...deps, bucket }, input)).toMatchObject({
      continued: true,
    });
    expect(deps.jobQueue.sent[0]?.envelope.data).toEqual({
      ...input,
      cursor: "opaque-next",
    });
  });
  it("does not scan a disabled scheduled run", async () => {
    const { deps, input } = setup();
    const list = vi.spyOn(env.FILES, "list");
    expect(
      await reconcileStorage(
        { ...deps, storageReconcile: "off" },
        { ...input, trigger: "scheduled" }
      )
    ).toMatchObject({ mode: "off", scanned: 0 });
    expect(list).not.toHaveBeenCalled();
    list.mockRestore();
  });
});
