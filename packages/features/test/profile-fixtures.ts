import { env } from "cloudflare:workers";
import { sequentialIds, useCaseDeps } from "./fixtures";
export const png = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0,
]);
export function profileDeps() {
  return { ...useCaseDeps(), bucket: env.FILES, ids: sequentialIds() };
}

/** Gate real R2 writes after persistence but before a use case publishes its reference. */
export function gatedProfilePuts(bucket: R2Bucket) {
  const writes: {
    readonly key: string;
    readonly body: Parameters<R2Bucket["put"]>[1];
    readonly release: () => void;
  }[] = [];
  const waiting: { readonly count: number; readonly resolve: () => void }[] =
    [];
  const proxy = new Proxy(bucket, {
    get(target, property) {
      if (property === "put")
        return async (...args: Parameters<R2Bucket["put"]>) => {
          const result = await target.put(...args);
          let release: () => void = () => {};
          const held = new Promise<void>((resolve) => {
            release = resolve;
          });
          writes.push({ key: args[0], body: args[1], release });
          for (const waiter of waiting)
            if (writes.length >= waiter.count) waiter.resolve();
          await held;
          return result;
        };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return {
    bucket: proxy,
    writes,
    arrived: (count: number) =>
      writes.length >= count
        ? Promise.resolve()
        : new Promise<void>((resolve) => waiting.push({ count, resolve })),
  };
}
