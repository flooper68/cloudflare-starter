import { describeMetricsContract } from "../../ports/metrics.contract";
import { noopMetrics } from "./noop-metrics";

describeMetricsContract("noopMetrics", () => ({ metrics: noopMetrics }));
