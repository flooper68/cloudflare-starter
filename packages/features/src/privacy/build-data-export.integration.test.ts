import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildDataExport } from "./build-data-export";
import { dataRequests } from "./privacy.schema";
import { requestDataExport } from "./request-data-export";

describe("buildDataExport", () => {
  it("builds and publishes once, sends completion, and is idempotent on redelivery", async () => {
    const { deps, person } = await privacyFixture();
    const r = await requestDataExport(deps, person.id);
    await buildDataExport(deps, { requestId: r.id, attempts: 1 });
    const [row] = await deps.db
      .select()
      .from(dataRequests)
      .where(eq(dataRequests.id, r.id));
    expect(row?.status).toBe("ready");
    expect(row?.expiresAt?.getTime()).toBe(
      deps.clock.now().getTime() + 86400000
    );
    expect(row?.uploadId).toBeNull();
    expect(deps.notify).toHaveBeenCalledOnce();
    await buildDataExport(deps, { requestId: r.id, attempts: 2 });
    expect(deps.notify).toHaveBeenCalledOnce();
  });
  it("aborts failed multipart state and leaves a retryable request", async () => {
    const { deps, person } = await privacyFixture();
    const r = await requestDataExport(deps, person.id);
    const abort = vi.fn().mockResolvedValue(undefined);
    const bucket = new Proxy(deps.bucket, {
      get(target, key) {
        if (key === "createMultipartUpload")
          return async () => ({
            uploadId: "broken",
            abort,
            uploadPart: async () => {
              throw new Error("R2 write failed");
            },
            complete: async () => {},
          });
        const v = Reflect.get(target, key, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    await expect(
      buildDataExport({ ...deps, bucket }, { requestId: r.id, attempts: 1 })
    ).rejects.toThrow("R2 write failed");
    expect(abort).toHaveBeenCalledOnce();
    const [row] = await deps.db
      .select()
      .from(dataRequests)
      .where(eq(dataRequests.id, r.id));
    expect(row).toMatchObject({
      status: "queued",
      uploadId: null,
      objectKey: null,
    });
  });
  it("keeps failed cleanup state and reports it so a retry can abort the upload", async () => {
    const { deps, person } = await privacyFixture();
    const request = await requestDataExport(deps, person.id);
    const bucket = new Proxy(deps.bucket, {
      get(target, key) {
        if (key === "createMultipartUpload")
          return async () => ({
            uploadId: "cleanup-pending",
            abort: async () => {
              throw new Error("abort offline");
            },
            uploadPart: async () => {
              throw new Error("write offline");
            },
            complete: async () => {},
          });
        const v = Reflect.get(target, key, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    await expect(
      buildDataExport(
        { ...deps, bucket },
        { requestId: request.id, attempts: 1 }
      )
    ).rejects.toThrow("write offline");
    const [row] = await deps.db
      .select()
      .from(dataRequests)
      .where(eq(dataRequests.id, request.id));
    expect(row?.uploadId).toBe("cleanup-pending");
    expect(row?.objectKey).toMatch(/^exports\//);
    expect(deps.errors.captured).toHaveLength(1);
  });
  it("refuses a parallel delivery during the durable lease", async () => {
    const { deps, person } = await privacyFixture();
    const request = await requestDataExport(deps, person.id);
    let entered!: () => void;
    let resume!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const bucket = new Proxy(deps.bucket, {
      get(target, key) {
        if (key === "createMultipartUpload")
          return async (
            ...args: Parameters<R2Bucket["createMultipartUpload"]>
          ) => {
            entered();
            await gate;
            return target.createMultipartUpload(...args);
          };
        const v = Reflect.get(target, key, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const first = buildDataExport(
      { ...deps, bucket },
      { requestId: request.id, attempts: 1 }
    );
    await started;
    await expect(
      buildDataExport(deps, { requestId: request.id, attempts: 1 })
    ).rejects.toMatchObject({ code: "EXPORT_LOCKED" });
    resume();
    await first;
    expect(deps.notify).toHaveBeenCalledOnce();
  });
  it("retains prior attempt references across consecutive cleanup failures", async () => {
    const { deps, person } = await privacyFixture();
    const request = await requestDataExport(deps, person.id);
    const key = `exports/${request.id}/old.zip`;
    await deps.db
      .update(dataRequests)
      .set({ objectKey: key, uploadId: "old-multipart" })
      .where(eq(dataRequests.id, request.id));
    const abort = vi.fn().mockRejectedValue(new Error("old abort offline"));
    const bucket = new Proxy(deps.bucket, {
      get(target, property) {
        if (property === "resumeMultipartUpload")
          return () => ({ abort, uploadId: "old-multipart", key });
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    for (let attempts = 1; attempts <= 2; attempts++) {
      await expect(
        buildDataExport(
          { ...deps, bucket },
          { requestId: request.id, attempts }
        )
      ).rejects.toThrow("old abort offline");
      const [row] = await deps.db
        .select()
        .from(dataRequests)
        .where(eq(dataRequests.id, request.id));
      expect(row).toMatchObject({
        status: "queued",
        objectKey: key,
        uploadId: "old-multipart",
      });
    }
    expect(abort).toHaveBeenCalledTimes(4);
  });
});
