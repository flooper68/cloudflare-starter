import { describeFeatureFlagsContract } from "../../ports/feature-flags.contract";
import { createMemoryFeatureFlags } from "./memory-feature-flags";

describeFeatureFlagsContract("createMemoryFeatureFlags", () => {
  const memory = createMemoryFeatureFlags();
  return { flags: memory, store: memory };
});
