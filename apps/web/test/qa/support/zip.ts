/**
 * Reads a ZIP archive's entries (stored or deflated) with node:zlib, enough to check a
 * data export's contents without a dependency or a system tool.
 */
import { inflateRawSync } from "node:zlib";

export function readZip(archive: Buffer): Map<string, Buffer> {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0)
    throw new Error("not a ZIP archive (no end of central directory)");
  const count = archive.readUInt16LE(end + 10);
  let offset = archive.readUInt32LE(end + 16);
  const entries = new Map<string, Buffer>();
  for (let index = 0; index < count; index++) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("corrupt central directory");
    }
    const method = archive.readUInt16LE(offset + 10);
    const compressed = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const local = archive.readUInt32LE(offset + 42);
    const name = archive.toString(
      "utf8",
      offset + 46,
      offset + 46 + nameLength
    );
    const dataStart =
      local +
      30 +
      archive.readUInt16LE(local + 26) +
      archive.readUInt16LE(local + 28);
    const data = archive.subarray(dataStart, dataStart + compressed);
    if (!name.endsWith("/")) {
      entries.set(
        name,
        method === 8 ? inflateRawSync(data) : Buffer.from(data)
      );
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
