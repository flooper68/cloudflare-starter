import { describe, expect, it } from "vitest";
import { seedUser, seedWorkspace, storeTestFile } from "../../test/fixtures";
import { privacyFixture } from "../../test/privacy-fixtures";
import { createFileRecord } from "../files";
import { writeExportArchive } from "./write-export-archive";

describe("writeExportArchive", () => {
  it("includes manifest, safe data and personal files; excludes another user's bytes", async () => {
    const { deps, person, actor } = await privacyFixture();
    const file = await storeTestFile(actor, "mine.txt", "my private bytes");
    const other = await seedWorkspace(
      (await seedUser("Private other", "private-other@example.test")).id,
      { kind: "personal" }
    );
    const secret = await storeTestFile(other, "other.txt", "never export me");
    const multipart =
      await deps.bucket.createMultipartUpload("test-export.zip");
    const result = await writeExportArchive(
      deps,
      { userId: person.id, scope: "user", workspaceId: null },
      { multipart, createdAt: deps.clock.now().toISOString() }
    );
    expect(result.bytes).toBeGreaterThan(0);
    expect(deps.zip.entries.has("manifest.json")).toBe(true);
    expect(
      new TextDecoder().decode(
        deps.zip.entries.get(`files/${encodeURIComponent(file.fileId)}`)
      )
    ).toBe("my private bytes");
    expect(
      deps.zip.entries.has(`files/${encodeURIComponent(secret.fileId)}`)
    ).toBe(false);
    expect(
      new TextDecoder().decode(deps.zip.entries.get("data/user/000001.ndjson"))
    ).not.toContain("password");
    expect(await deps.bucket.head("test-export.zip")).not.toBeNull();
  });
  it("paginates rows, excludes own shared-file bytes, and reports unfinished uploads", async () => {
    const { deps, person, actor } = await privacyFixture();
    const shared = await seedWorkspace(person.id, {
      id: "shared-export",
      kind: "shared",
    });
    const sharedFile = await storeTestFile(
      shared,
      "shared.txt",
      "shared bytes"
    );
    for (let i = 0; i < 12; i++)
      await storeTestFile(actor, `row-${i}.txt`, String(i));
    const pending = await createFileRecord(deps, actor, {
      filename: "unfinished.txt",
      mimeType: "text/plain",
      sizeBytes: 100,
    });
    const multipart =
      await deps.bucket.createMultipartUpload("paged-export.zip");
    await writeExportArchive(
      deps,
      { userId: person.id, scope: "user", workspaceId: null },
      { multipart, createdAt: deps.clock.now().toISOString() }
    );
    expect(deps.zip.entries.has("data/files/000002.ndjson")).toBe(true);
    expect(
      [...deps.zip.entries.values()].some((bytes) =>
        new TextDecoder().decode(bytes).includes(sharedFile.fileId)
      )
    ).toBe(true);
    expect(
      deps.zip.entries.has(`files/${encodeURIComponent(sharedFile.fileId)}`)
    ).toBe(false);
    expect(
      deps.zip.entries.has(
        `missing-files/${encodeURIComponent(pending.fileId)}.json`
      )
    ).toBe(true);
  });
  it("flushes full 5 MiB parts and streams a larger file without a whole-archive buffer", async () => {
    const { deps, person, actor } = await privacyFixture();
    await storeTestFile(actor, "large.txt", "x".repeat(6 * 1024 * 1024));
    const real = await deps.bucket.createMultipartUpload(
      "multipart-export.zip"
    );
    const sizes: number[] = [];
    const multipart = new Proxy(real, {
      get(target, key) {
        if (key === "uploadPart")
          return async (n: number, value: Uint8Array) => {
            sizes.push(value.byteLength);
            return target.uploadPart(n, value);
          };
        const v = Reflect.get(target, key, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    await writeExportArchive(
      deps,
      { userId: person.id, scope: "user", workspaceId: null },
      { multipart, createdAt: deps.clock.now().toISOString() }
    );
    expect(sizes[0]).toBe(5 * 1024 * 1024);
    expect(sizes.length).toBeGreaterThan(1);
    expect(sizes.at(-1)).toBeLessThan(5 * 1024 * 1024);
  });
});
