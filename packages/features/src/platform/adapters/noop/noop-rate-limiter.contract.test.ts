import { describeRateLimiterContract } from "../../ports/rate-limiter.contract";
import { noopRateLimiter } from "./noop-rate-limiter";

describeRateLimiterContract("noop", () => ({
  limiter: noopRateLimiter,
  rule: { limit: 2, periodSeconds: 60 },
  enforces: false,
}));
