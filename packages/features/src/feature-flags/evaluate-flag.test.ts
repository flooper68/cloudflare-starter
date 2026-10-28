import { describe, expect, it } from "vitest";

import type { FeatureFlags } from "../platform";
import { createMemoryFeatureFlags, noopFeatureFlags } from "../platform";
import { evaluateFlag } from "./evaluate-flag";

const subject = {
  userId: "user-ada",
  workspaceId: "ws-analytical",
  plan: null,
  environment: "production",
};

describe("evaluateFlag", () => {
  it("passes the catalog default and the workspace as targeting key", async () => {
    const memory = createMemoryFeatureFlags();
    await memory.update(
      "upload-demo-presigned",
      { enabled: true, fallthrough: true },
      "user-grace"
    );
    await memory.setRules(
      "upload-demo-presigned",
      [{ kind: "workspace", workspaceId: "ws-analytical", value: false }],
      "user-grace"
    );
    expect(
      await evaluateFlag(memory, "upload-demo-presigned", subject)
    ).toMatchObject({ value: false, reason: "TARGETING_MATCH" });
    expect(
      await evaluateFlag(memory, "upload-demo-presigned", {
        ...subject,
        workspaceId: "ws-other",
      })
    ).toMatchObject({ value: true, reason: "DEFAULT" });
  });

  it("resolves to the catalog default when flags are off or unconfigured", async () => {
    expect(
      await evaluateFlag(noopFeatureFlags, "upload-demo-presigned", subject)
    ).toMatchObject({ value: true, reason: "DEFAULT" });
    expect(
      await evaluateFlag(
        createMemoryFeatureFlags(),
        "upload-demo-presigned",
        subject
      )
    ).toMatchObject({ value: true, errorCode: "FLAG_NOT_FOUND" });
  });

  it("asks the provider for the catalog type with the catalog default", async () => {
    const calls: unknown[] = [];
    const spy: FeatureFlags = {
      ...noopFeatureFlags,
      getBooleanDetails: (key, defaultValue, context) => {
        calls.push({ key, defaultValue, context });
        return noopFeatureFlags.getBooleanDetails(key, defaultValue, context);
      },
    };
    await evaluateFlag(spy, "upload-demo-presigned", subject);
    expect(calls).toEqual([
      {
        key: "upload-demo-presigned",
        defaultValue: true,
        context: { targetingKey: "ws-analytical", ...subject },
      },
    ]);
  });
});
