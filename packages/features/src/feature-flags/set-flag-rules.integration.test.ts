import { describe, expect, it } from "vitest";

import { rows, useCaseDeps } from "../../test/fixtures";
import { createMemoryFeatureFlags } from "../platform";
import {
  FlagStoreUnavailableError,
  FlagValueTypeError,
  UnknownFlagError,
} from "./domain";
import { setFlagRules } from "./set-flag-rules";

describe("setFlagRules", () => {
  it("replaces the rules in order and records feature_flag.rules_changed without the targets", async () => {
    const memory = createMemoryFeatureFlags();
    const rules = [
      { kind: "workspace", workspaceId: "ws-analytical", value: true },
      { kind: "percentage", percentageBp: 5000, value: true },
    ] as const;
    expect(
      await setFlagRules(
        { ...useCaseDeps(), flagStore: memory },
        { key: "upload-demo-presigned", rules, actorUserId: "user-grace" }
      )
    ).toMatchObject({ enabled: false, rules });
    expect(
      await rows(
        "SELECT action, actor_kind, actor_user_id, workspace_id, metadata FROM audit_events WHERE target_id = 'upload-demo-presigned'"
      )
    ).toEqual([
      {
        action: "feature_flag.rules_changed",
        actor_kind: "admin",
        actor_user_id: "user-grace",
        workspace_id: null,
        metadata: JSON.stringify({
          ruleCount: 2,
          ruleKinds: ["workspace", "percentage"],
        }),
      },
    ]);
  });

  it("refuses rule values of another type and unknown flags", async () => {
    const deps = { ...useCaseDeps(), flagStore: createMemoryFeatureFlags() };
    await expect(
      setFlagRules(deps, {
        key: "upload-demo-presigned",
        rules: [{ kind: "percentage", percentageBp: 5000, value: 1 }],
        actorUserId: "user-grace",
      })
    ).rejects.toMatchObject({ code: "FLAG_VALUE_TYPE_MISMATCH" });
    await expect(
      setFlagRules(deps, {
        key: "upload-demo-presigned",
        rules: [{ kind: "percentage", percentageBp: 5000, value: 1 }],
        actorUserId: "user-grace",
      })
    ).rejects.toBeInstanceOf(FlagValueTypeError);
    await expect(
      setFlagRules(deps, {
        key: "dark-launch",
        rules: [],
        actorUserId: "user-grace",
      })
    ).rejects.toBeInstanceOf(UnknownFlagError);
  });

  it("fails as unavailable without a store", async () => {
    await expect(
      setFlagRules(
        { ...useCaseDeps(), flagStore: null },
        { key: "upload-demo-presigned", rules: [], actorUserId: "user-grace" }
      )
    ).rejects.toMatchObject({ code: "FLAG_STORE_UNAVAILABLE" });
    await expect(
      setFlagRules(
        { ...useCaseDeps(), flagStore: null },
        { key: "upload-demo-presigned", rules: [], actorUserId: "user-grace" }
      )
    ).rejects.toBeInstanceOf(FlagStoreUnavailableError);
  });
});
