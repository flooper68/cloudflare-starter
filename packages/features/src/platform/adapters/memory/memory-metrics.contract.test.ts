import { describeMetricsContract } from "../../ports/metrics.contract";
import { createMemoryMetrics } from "./memory-metrics";

describeMetricsContract("createMemoryMetrics", () => {
  const metrics = createMemoryMetrics();
  return { metrics, exported: () => metrics.exported };
});
