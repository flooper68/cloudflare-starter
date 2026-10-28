import { describe, expect, it } from "vitest";

import {
  contractFlagContext,
  describeFeatureFlagsContract,
} from "../../ports/feature-flags.contract";
import { noopFeatureFlags } from "./noop-feature-flags";

describeFeatureFlagsContract("noopFeatureFlags", () => ({
  flags: noopFeatureFlags,
}));

describe("noopFeatureFlags", () => {
  it("resolves every flag to the caller's default with reason DEFAULT", async () => {
    expect(
      await noopFeatureFlags.getStringDetails(
        "upload-demo-presigned",
        "cards",
        contractFlagContext()
      )
    ).toEqual({
      flagKey: "upload-demo-presigned",
      value: "cards",
      variant: "default",
      reason: "DEFAULT",
      flagMetadata: {},
    });
  });
});
