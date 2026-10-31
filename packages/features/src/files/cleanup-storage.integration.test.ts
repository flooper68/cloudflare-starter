import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { storeTestFile, trashTestFile } from "../../test/fixtures";
import { memoryAdminAuthGateway } from "../../test/memory-admin-auth-gateway";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildErasureHandlers } from "../erasure-catalog";
import { completeUserErasure, prepareUserErasure } from "../privacy";
import { cleanupStorage } from "./cleanup-storage";
import { createPresignedUpload } from "./create-presigned-upload";
import { pendingFileCleanup } from "./files.schema";
import { rememberErasureStorage } from "./remember-erasure-storage";
import { rememberUploadCleanup } from "./remember-upload-cleanup";
import { retryFileCleanups } from "./retry-file-cleanups";

describe("cleanupStorage", () => {
  it("retains both live and trashed referenced files", async () => {
    const { deps, actor } = await privacyFixture();
    const file = await storeTestFile(actor);
    for (const trash of [false, true]) {
      if (trash) await trashTestFile(actor, file.fileId);
      await rememberUploadCleanup(deps, {
        r2Key: file.r2Key,
        workspaceId: actor.workspaceId,
      });
      expect(await cleanupStorage(deps, { target: file.r2Key })).toMatchObject({
        deleted: 0,
      });
      expect(await env.FILES.head(file.r2Key)).not.toBeNull();
    }
  });
  it("does not erase a prefix while either the original user or workspace still exists", async () => {
    const { deps, person, actor } = await privacyFixture();
    const file = await storeTestFile(actor);
    await rememberErasureStorage(deps, {
      userId: person.id,
      workspaceIds: [actor.workspaceId],
    });
    const later = {
      ...deps,
      clock: { now: () => new Date(deps.clock.now().getTime() + 3600001) },
    };
    expect(
      await cleanupStorage(later, {
        target: `workspaces/${actor.workspaceId}/`,
      })
    ).toMatchObject({ retained: true, deleted: 0 });
    expect(await env.FILES.head(file.r2Key)).not.toBeNull();
    await env.DB.prepare("DELETE FROM workspaces WHERE id=?")
      .bind(actor.workspaceId)
      .run();
    expect(
      await cleanupStorage(later, {
        target: `workspaces/${actor.workspaceId}/`,
      })
    ).toMatchObject({ retained: true, deleted: 0 });
    expect(await env.FILES.head(file.r2Key)).not.toBeNull();
  });
  it("waits for issued PUT expiry, retains intent through two sweeps, and retries a failed second sweep", async () => {
    const { deps, person, actor } = await privacyFixture();
    const upload = await createPresignedUpload(
      {
        ...deps,
        r2: {
          accountId: "test-account",
          accessKeyId: "test-access",
          secretAccessKey: "test-secret",
          filesBucketName: "test-bucket",
        },
      },
      actor,
      { filename: "signed.txt", mimeType: "text/plain", sizeBytes: 4 }
    );
    expect(new URL(upload.uploadUrl).searchParams.get("X-Amz-Expires")).toBe(
      "3600"
    );
    await prepareUserErasure(
      { ...deps, ...buildErasureHandlers(deps) },
      { userId: person.id, operationId: "signed-erasure" }
    );
    await memoryAdminAuthGateway().deleteUser(person.id);
    await completeUserErasure(deps, {
      userId: person.id,
      email: person.email,
      operationId: "signed-erasure",
    });
    const target = `workspaces/${actor.workspaceId}/`;
    const start = deps.clock.now().getTime();
    // Models R2 accepting an already-issued signed PUT after application metadata vanished.
    await env.FILES.put(upload.r2Key, "late");
    expect(
      await cleanupStorage(
        { ...deps, clock: { now: () => new Date(start + 3599999) } },
        { target }
      )
    ).toMatchObject({ retained: true, deleted: 0 });
    expect(await env.FILES.head(upload.r2Key)).not.toBeNull();
    const first = { ...deps, clock: { now: () => new Date(start + 3600000) } };
    expect(await cleanupStorage(first, { target })).toMatchObject({
      retained: true,
      deleted: 1,
    });
    expect(await env.FILES.head(upload.r2Key)).toBeNull();
    expect(
      (
        await deps.db
          .select()
          .from(pendingFileCleanup)
          .where(eq(pendingFileCleanup.target, target))
      )[0]?.sweep
    ).toBe(1);
    // A request accepted before expiry may finish after the first sweep.
    await env.FILES.put(upload.r2Key, "very late");
    const second = {
      ...deps,
      clock: { now: () => new Date(start + 3600000 + 86400000) },
    };
    const failing = new Proxy(env.FILES, {
      get(bucket, key) {
        if (key === "delete")
          return async () => {
            throw new Error("second sweep offline");
          };
        const value = Reflect.get(bucket, key, bucket);
        return typeof value === "function" ? value.bind(bucket) : value;
      },
    });
    await expect(
      cleanupStorage({ ...second, bucket: failing }, { target })
    ).rejects.toThrow("second sweep offline");
    expect(
      await deps.db
        .select()
        .from(pendingFileCleanup)
        .where(eq(pendingFileCleanup.target, target))
    ).toHaveLength(1);
    expect(await cleanupStorage(second, { target })).toMatchObject({
      retained: false,
      deleted: 1,
    });
    expect(await env.FILES.head(upload.r2Key)).toBeNull();
    expect(
      await deps.db
        .select()
        .from(pendingFileCleanup)
        .where(eq(pendingFileCleanup.target, target))
    ).toHaveLength(0);
  });
  it("resumes a persisted page cursor after failed publication and handles duplicate deliveries without skipping the second sweep", async () => {
    const { deps, person, actor } = await privacyFixture();
    await prepareUserErasure(
      { ...deps, ...buildErasureHandlers(deps) },
      { userId: person.id, operationId: "paged-erasure" }
    );
    await memoryAdminAuthGateway().deleteUser(person.id);
    await completeUserErasure(deps, {
      userId: person.id,
      email: person.email,
      operationId: "paged-erasure",
    });
    const target = `workspaces/${actor.workspaceId}/`;
    const keys = Array.from(
      { length: 105 },
      (_, i) => `${target}uploads/2026/10/late-${String(i).padStart(3, "0")}`
    );
    for (let i = 0; i < keys.length; i += 10)
      await Promise.all(
        keys
          .slice(i, i + 10)
          .map((key) => env.FILES.put(key, "late private data"))
      );
    const first = {
      ...deps,
      clock: { now: () => new Date(deps.clock.now().getTime() + 3600000) },
    };
    await expect(
      cleanupStorage(
        {
          ...first,
          jobQueue: {
            send: async () => {
              throw new Error("continuation publication unavailable");
            },
          },
        },
        { target }
      )
    ).rejects.toThrow("continuation publication unavailable");
    const [partial] = await deps.db
      .select()
      .from(pendingFileCleanup)
      .where(eq(pendingFileCleanup.target, target));
    expect(partial?.cursor).toBeTruthy();
    expect(partial?.sweep).toBe(0);
    expect((await env.FILES.list({ prefix: target })).objects).toHaveLength(5);
    await retryFileCleanups(first, {});
    const redelivery = deps.jobQueue.sent.find(
      (message) =>
        message.envelope.type === "files.cleanup-storage" &&
        (message.envelope.data as { target: string }).target === target
    );
    expect(redelivery).toBeDefined();
    expect(
      await cleanupStorage(
        first,
        redelivery?.envelope.data as { target: string }
      )
    ).toMatchObject({ deleted: 5, retained: true });
    expect((await env.FILES.list({ prefix: target })).objects).toHaveLength(0);
    const [waiting] = await deps.db
      .select()
      .from(pendingFileCleanup)
      .where(eq(pendingFileCleanup.target, target));
    expect(waiting).toMatchObject({ sweep: 1, cursor: null });
    expect(waiting?.notBefore.getTime()).toBe(
      first.clock.now().getTime() + 86400000
    );
    // A duplicate first-pass delivery only schedules the future pass; it cannot retire the intent.
    expect(await cleanupStorage(first, { target })).toMatchObject({
      deleted: 0,
      retained: true,
    });
    expect(
      (
        await deps.db
          .select()
          .from(pendingFileCleanup)
          .where(eq(pendingFileCleanup.target, target))
      )[0]?.sweep
    ).toBe(1);
    await env.FILES.put(keys[0] ?? "missing", "finished between sweeps");
    const second = {
      ...deps,
      clock: { now: () => new Date(first.clock.now().getTime() + 86400000) },
    };
    expect(await cleanupStorage(second, { target })).toMatchObject({
      deleted: 1,
      retained: false,
    });
    expect((await env.FILES.list({ prefix: target })).objects).toHaveLength(0);
    expect(await cleanupStorage(second, { target })).toEqual({
      deleted: 0,
      retained: false,
    });
  });
});
