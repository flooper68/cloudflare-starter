import type { Zip } from "../../ports";
import { createFflateZip } from "../fflate";
/** Records entries in memory for small tests while preserving the real ZIP wire contract. */
export function createMemoryZip(): Zip & { entries: Map<string, Uint8Array> } {
  const entries = new Map<string, Uint8Array>();
  return {
    entries,
    create(write) {
      const writer = createFflateZip().create(write);
      return {
        ...writer,
        async add(name, body) {
          const chunks: Uint8Array[] = [];
          let size = 0;
          const recorded = body.pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
              transform(chunk, controller) {
                chunks.push(chunk.slice());
                size += chunk.length;
                controller.enqueue(chunk);
              },
            })
          );
          await writer.add(name, recorded);
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const c of chunks) {
            bytes.set(c, offset);
            offset += c.length;
          }
          entries.set(name, bytes);
        },
      };
    },
  };
}
