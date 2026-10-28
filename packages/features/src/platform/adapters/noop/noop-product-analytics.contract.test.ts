import { describeProductAnalyticsContract } from "../../ports/product-analytics.contract";
import { noopProductAnalytics } from "./noop-product-analytics";

describeProductAnalyticsContract("noop", () => ({
  analytics: noopProductAnalytics,
  delivered: () => null,
}));
