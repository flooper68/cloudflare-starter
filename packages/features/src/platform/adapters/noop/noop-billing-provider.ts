import { DomainError } from "../../../kernel";
import type { BillingProvider } from "../../ports";

const UNAVAILABLE =
  "Online checkout is not available: billing is off or managed by an admin (BILLING is not provider)";

/**
 * BillingProvider for BILLING=off and BILLING=manual: nothing to sell, so checkout and the
 * portal are `unavailable`, and no webhook is acted on.
 */
export const noopBillingProvider: BillingProvider = {
  name: "none",
  createCheckout: async () => {
    throw new DomainError("unavailable", UNAVAILABLE);
  },
  portalUrl: async () => {
    throw new DomainError("unavailable", UNAVAILABLE);
  },
  parseWebhook: async () => null,
};
