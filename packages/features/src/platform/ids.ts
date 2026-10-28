import type { Ids } from "../kernel";

/** Random UUIDs from the runtime. Tests pass predictable ones instead. */
export const randomIds: Ids = { uuid: () => crypto.randomUUID() };
