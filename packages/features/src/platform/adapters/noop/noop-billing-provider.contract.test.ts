import { describeBillingProviderContract } from "../../ports/billing-provider.contract";
import { noopBillingProvider } from "./noop-billing-provider";

describeBillingProviderContract("noopBillingProvider", () => ({
  provider: noopBillingProvider,
  sells: false,
}));
