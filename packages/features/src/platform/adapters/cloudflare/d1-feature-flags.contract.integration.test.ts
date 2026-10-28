// Runs in workerd (features-integration) against the real local D1 with the migrations.
import { env } from "cloudflare:workers";

import { describeFeatureFlagsContract } from "../../ports/feature-flags.contract";
import { createD1FeatureFlags } from "./d1-feature-flags";

describeFeatureFlagsContract("createD1FeatureFlags", () => {
  const d1 = createD1FeatureFlags({
    d1: env.DB,
    clock: { now: () => new Date("2026-10-28T12:00:00.000Z") },
  });
  return { flags: d1, store: d1 };
});
