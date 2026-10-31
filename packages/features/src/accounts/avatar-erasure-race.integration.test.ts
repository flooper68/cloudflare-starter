import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { memoryAdminAuthGateway } from "../../test/memory-admin-auth-gateway";
import { privacyFixture } from "../../test/privacy-fixtures";
import { buildErasureHandlers } from "../erasure-catalog";
import {
  cleanupStorage,
  pendingFileCleanup,
  rememberErasureStorage,
} from "../files";
import { completeUserErasure, prepareUserErasure } from "../privacy";
import { setAccountAvatar } from "./set-account-avatar";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

describe("avatar upload across account erasure", () => {
  it("a real late avatar put fails its FK publication and both mandatory sweeps remove late bytes", async () => {
    const { deps, person } = await privacyFixture();
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
          return async (
            k: string,
            value: Uint8Array,
            options: R2PutOptions
          ) => {
            key = k;
            entered();
            await gate;
            return target.put(k, value, options);
          };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const upload = setAccountAvatar(
      { ...deps, bucket },
      { userId: person.id, bytes: png, contentType: "image/png" }
    );
    await started;
    await prepareUserErasure(
      { ...deps, ...buildErasureHandlers(deps) },
      { userId: person.id, operationId: "avatar-erasure" }
    );
    await memoryAdminAuthGateway().deleteUser(person.id);
    await completeUserErasure(deps, {
      userId: person.id,
      email: person.email,
      operationId: "avatar-erasure",
    });
    resume();
    await expect(upload).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringMatching(/constraint|FOREIGN KEY/i),
      }),
    });
    expect(
      (
        await env.DB.prepare(
          "SELECT user_id FROM user_settings WHERE user_id=?"
        )
          .bind(person.id)
          .all()
      ).results
    ).toHaveLength(0);
    expect(await env.FILES.head(key)).not.toBeNull();
    const target = `users/${person.id}/avatar/`;
    const [intent] = await deps.db
      .select()
      .from(pendingFileCleanup)
      .where(eq(pendingFileCleanup.target, target));
    expect(intent?.workspaceId).toBeNull();
    expect(intent?.userId).toBe(person.id);
    const first = {
      ...deps,
      clock: { now: () => new Date(deps.clock.now().getTime() + 3600000) },
    };
    expect(await cleanupStorage(first, { target })).toMatchObject({
      deleted: 1,
      retained: true,
    });
    expect(await env.FILES.head(key)).toBeNull();
    // Another avatar write accepted before erasure finishes between the mandatory sweeps.
    await env.FILES.put(key, png);
    const second = {
      ...deps,
      clock: { now: () => new Date(first.clock.now().getTime() + 86400000) },
    };
    const failing = new Proxy(env.FILES, {
      get(target, property) {
        if (property === "delete")
          return async () => {
            throw new Error("avatar cleanup offline");
          };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await expect(
      cleanupStorage({ ...second, bucket: failing }, { target })
    ).rejects.toThrow("avatar cleanup offline");
    expect(
      await deps.db
        .select()
        .from(pendingFileCleanup)
        .where(eq(pendingFileCleanup.target, target))
    ).toHaveLength(1);
    await cleanupStorage(second, { target });
    expect(await env.FILES.head(key)).toBeNull();
    expect(
      await deps.db
        .select()
        .from(pendingFileCleanup)
        .where(eq(pendingFileCleanup.target, target))
    ).toHaveLength(0);
  });
  it("never deletes an avatar prefix while the original user remains after partial erasure", async () => {
    const { deps, person } = await privacyFixture();
    const key = `users/${person.id}/avatar/live`;
    await env.FILES.put(key, png);
    await rememberErasureStorage(deps, {
      userId: person.id,
      workspaceIds: [],
      includeAvatar: true,
    });
    const later = {
      ...deps,
      clock: { now: () => new Date(deps.clock.now().getTime() + 2 * 86400000) },
    };
    expect(
      await cleanupStorage(later, { target: `users/${person.id}/avatar/` })
    ).toMatchObject({ deleted: 0, retained: true });
    expect(await env.FILES.head(key)).not.toBeNull();
  });
});
