import type { Random } from "../kernel";

/** The runtime's random numbers, for retry jitter. Tests pass a fixed sequence instead. */
export const mathRandom: Random = { next: () => Math.random() };
