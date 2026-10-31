import { describe, expect, it } from "vitest";
import type { Zip } from "./zip";
export function describeZipContract(
  name: string,
  make: () => Zip,
  decode: (bytes: Uint8Array) => Record<string, Uint8Array>
) {
  describe(name, () => {
    it("streams ordered named entries into a valid ZIP and awaits the sink", async () => {
      const chunks: Uint8Array[] = [];
      let running = false;
      const writer = make().create(async (c) => {
        expect(running).toBe(false);
        running = true;
        await Promise.resolve();
        chunks.push(c.slice());
        running = false;
      });
      const body = (s: string) =>
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new TextEncoder().encode(s));
            c.close();
          },
        });
      await writer.add("data/profile.ndjson", body('{"name":"Ada"}\n'));
      await writer.add("files/1", body("bytes"));
      await writer.close();
      const total = new Uint8Array(
        chunks.reduce((sum, c) => sum + c.length, 0)
      );
      let offset = 0;
      for (const c of chunks) {
        total.set(c, offset);
        offset += c.length;
      }
      const files = decode(total);
      expect(Object.keys(files)).toEqual(["data/profile.ndjson", "files/1"]);
      expect(new TextDecoder().decode(files["files/1"])).toBe("bytes");
    });
    it("rejects path traversal before writing", async () => {
      const writer = make().create(async () => {});
      await expect(
        writer.add(
          "../secret",
          new ReadableStream({
            start(c) {
              c.close();
            },
          })
        )
      ).rejects.toThrow(/path/);
      writer.abort();
    });
  });
}
