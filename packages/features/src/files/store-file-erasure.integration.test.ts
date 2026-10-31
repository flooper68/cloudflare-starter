import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { memoryAdminAuthGateway } from "../../test/memory-admin-auth-gateway";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildErasureHandlers } from "../erasure-catalog";
import { completeUserErasure, prepareUserErasure } from "../privacy";
import { cleanupStorage } from "./cleanup-storage";
import { pendingFileCleanup } from "./files.schema";
import { retryFileCleanups } from "./retry-file-cleanups";
import { storeFile } from "./store-file";

async function fixture(failDelete = false, failQueue = false) {
  const { deps, person, actor } = await privacyFixture();
  let entered!: () => void;
  let resume!: () => void;
  let key = "";
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const bucket = new Proxy(env.FILES, {
    get(target, property) {
      if (property === "put")
        return async (k: string, value: ArrayBuffer, options: R2PutOptions) => {
          key = k;
          entered();
          await gate;
          return target.put(k, value, options);
        };
      if (property === "delete" && failDelete)
        return async () => {
          throw new Error("late delete unavailable");
        };
      const v = Reflect.get(target, property, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
  const input = {
    filename: "late-private.txt",
    mimeType: "text/plain",
    sizeBytes: 7,
    body: new TextEncoder().encode("private").buffer as ArrayBuffer,
  };
  const pending = storeFile(
    {
      ...deps,
      bucket,
      jobQueue: failQueue
        ? {
            send: async () => {
              throw new Error("queue unavailable");
            },
          }
        : deps.jobQueue,
    },
    actor,
    input
  );
  await started;
  await prepareUserErasure(
    { ...deps, ...buildErasureHandlers(deps) },
    { userId: person.id, operationId: "erase-operation" }
  );
  await memoryAdminAuthGateway().deleteUser(person.id);
  await completeUserErasure(deps, {
    userId: person.id,
    email: person.email,
    operationId: "erase-operation",
  });
  return { deps, person, actor, pending, key, resume };
}
describe("binding upload versus erasure", () => {
  it("refuses an actual late successful R2 put after user/workspace erasure and removes its bytes", async () => {
    const x = await fixture();
    x.resume();
    await expect(x.pending).rejects.toMatchObject({ code: "UPLOAD_ERASED" });
    expect(await env.FILES.head(x.key)).toBeNull();
    expect(
      await x.deps.db
        .select()
        .from(pendingFileCleanup)
        .where(eq(pendingFileCleanup.target, x.key))
    ).toHaveLength(0);
    expect(x.deps.analytics.recorded).toHaveLength(0);
  });
  it("keeps durable target and queues retry when late-object cleanup fails", async () => {
    const x = await fixture(true);
    x.resume();
    await expect(x.pending).rejects.toThrow("late delete unavailable");
    expect(await env.FILES.head(x.key)).not.toBeNull();
    expect(
      await x.deps.db
        .select()
        .from(pendingFileCleanup)
        .where(eq(pendingFileCleanup.target, x.key))
    ).toHaveLength(1);
    expect(
      x.deps.jobQueue.sent.some(
        (m) =>
          m.envelope.type === "files.cleanup-storage" &&
          (m.envelope.data as { target: string }).target === x.key
      )
    ).toBe(true);
    await cleanupStorage(x.deps, { target: x.key });
    expect(await env.FILES.head(x.key)).toBeNull();
  });
  it("queue publication failure cannot lose a cleanup target; hourly retry repairs it even with general reconciliation off", async () => {
    const x = await fixture(true, true);
    x.resume();
    await expect(x.pending).rejects.toThrow("durable cleanup awaits retry");
    expect(
      await x.deps.db
        .select()
        .from(pendingFileCleanup)
        .where(eq(pendingFileCleanup.target, x.key))
    ).toHaveLength(1);
    await retryFileCleanups(x.deps, {});
    expect(
      x.deps.jobQueue.sent.some(
        (m) => (m.envelope.data as { target?: string }).target === x.key
      )
    ).toBe(true);
    await cleanupStorage(x.deps, { target: x.key });
    expect(await env.FILES.head(x.key)).toBeNull();
  });
});
