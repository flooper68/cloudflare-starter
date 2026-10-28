import type { Clock } from "../kernel";

/** The real clock. Tests pass a fixed one instead. */
export const systemClock: Clock = { now: () => new Date() };
