import type { Metrics } from "../../ports";

const ignore = { add: () => {}, record: () => {} };

/** Metrics that record nothing (`METRICS=none`). */
export const noopMetrics: Metrics = {
  counter: () => ignore,
  upDownCounter: () => ignore,
  histogram: () => ignore,
  flush: () => {},
};
