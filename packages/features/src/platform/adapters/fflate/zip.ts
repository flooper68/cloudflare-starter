import { Zip as FflateZip, ZipPassThrough } from "fflate";
import type { Zip } from "../../ports";
/** Stored ZIP entries avoid CPU-heavy recompression and stream with bounded backpressure. */
export function createFflateZip(): Zip {
  return {
    create(write) {
      let pending: Uint8Array[] = [];
      let failure: Error | undefined;
      let closed = false;
      let count = 0;
      const zip = new FflateZip((error, data) => {
        if (error) failure = error;
        else pending.push(data);
      });
      async function drain() {
        if (failure) throw failure;
        const chunks = pending;
        pending = [];
        for (const chunk of chunks) await write(chunk);
      }
      return {
        async add(name, body) {
          if (closed || ++count > 10000)
            throw new Error("ZIP entry limit exceeded or archive closed");
          if (
            !name ||
            name.startsWith("/") ||
            name.split("/").some((x) => x === ".." || x === "") ||
            name.includes("\\")
          )
            throw new Error("Invalid ZIP entry path");
          const entry = new ZipPassThrough(name);
          zip.add(entry);
          await drain();
          const reader = body.getReader();
          try {
            for (;;) {
              const part = await reader.read();
              if (part.done) break;
              entry.push(part.value, false);
              await drain();
            }
            entry.push(new Uint8Array(), true);
            await drain();
          } catch (error) {
            await reader.cancel(error);
            throw error;
          } finally {
            reader.releaseLock();
          }
        },
        async close() {
          if (closed) throw new Error("ZIP archive closed");
          closed = true;
          zip.end();
          await drain();
        },
        abort() {
          closed = true;
          zip.terminate();
          pending = [];
        },
      };
    },
  };
}
