import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  fixedClock,
  seedUser,
  seedWorkspace,
  sequentialIds,
  testDb,
  testRequestContext,
} from "../../test/fixtures";
import { createMemoryProductAnalytics } from "../platform";
import { storeFile } from "./store-file";

const body = new TextEncoder().encode("Q4 roadmap").buffer as ArrayBuffer;
const input = {
  filename: "roadmap.txt",
  mimeType: "text/plain",
  sizeBytes: 10,
};

describe("storeFile", () => {
  it("writes the object to the bucket and records the file", async () => {
    const owner = await seedUser();
    const actor = await seedWorkspace(owner.id);
    const analytics = createMemoryProductAnalytics();
    const file = await storeFile(
      {
        db: testDb(),
        bucket: env.FILES,
        clock: fixedClock(),
        ids: sequentialIds("aaaaaaaa-0000-4000-8000-"),
        requestContext: testRequestContext(),
        analytics,
      },
      actor,
      { ...input, body }
    );
    // Product analytics: category and size only, attributed to the actor's workspace.
    expect(
      analytics.recorded.map((call) => [
        call.event,
        call.properties,
        call.context.userId,
        call.context.workspaceId,
      ])
    ).toEqual([
      [
        "files.uploaded",
        { content_category: "text", size_bytes: 10 },
        owner.id,
        actor.workspaceId,
      ],
    ]);

    const object = await env.FILES.get(file.r2Key);
    expect(await object?.text()).toBe("Q4 roadmap");
    expect(object?.httpMetadata?.contentType).toBe("text/plain");
    const row = await env.DB.prepare("SELECT r2_key FROM files WHERE id = ?")
      .bind(file.fileId)
      .first();
    expect(row).toEqual({ r2_key: file.r2Key });
  });

  it("removes the record when the upload fails, keeping table and bucket in step", async () => {
    const owner = await seedUser("Grace Hopper");
    const actor = await seedWorkspace(owner.id);
    const failingBucket = {
      put: () => Promise.reject(new Error("bucket unavailable")),
    } as unknown as R2Bucket;
    const analytics = createMemoryProductAnalytics();

    await expect(
      storeFile(
        {
          db: testDb(),
          bucket: failingBucket,
          clock: fixedClock(),
          ids: sequentialIds("bbbbbbbb-0000-4000-8000-"),
          requestContext: testRequestContext(),
          analytics,
        },
        actor,
        { ...input, body }
      )
    ).rejects.toThrow("bucket unavailable");
    const count = await env.DB.prepare(
      "SELECT count(*) AS n FROM files WHERE workspace_id = ?"
    )
      .bind(actor.workspaceId)
      .first<{ n: number }>();
    expect(count?.n).toBe(0);
    // Nothing was stored, so nothing is tracked.
    expect(analytics.recorded).toEqual([]);
  });

  it("refuses a role without files.write", async () => {
    await expect(
      storeFile(
        {
          db: testDb(),
          bucket: env.FILES,
          clock: fixedClock(),
          ids: sequentialIds("ffffffff-0000-4000-8000-"),
          requestContext: testRequestContext(),
          analytics: createMemoryProductAnalytics(),
        },
        // A role outside the map, as stored by an older version of the roles.
        { userId: "u", workspaceId: "w", role: "guest" as never },
        { ...input, body }
      )
    ).rejects.toMatchObject({ kind: "forbidden" });
  });
});
