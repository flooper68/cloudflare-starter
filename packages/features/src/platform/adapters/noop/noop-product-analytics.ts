import type { ProductAnalytics } from "../../ports";

/** ProductAnalytics that records nothing (ANALYTICS=none). */
export const noopProductAnalytics: ProductAnalytics = {
  track: () => {},
  identify: () => {},
};
