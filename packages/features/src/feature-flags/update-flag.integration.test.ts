import { describe, expect, it } from "vitest";

import { rows, useCaseDeps } from "../../test/fixtures";
import { createMemoryFeatureFlags } from "../platform";
import {
  FlagStoreUnavailableError,
  FlagValueTypeError,
  UnknownFlagError,
} from "./domain";
import { updateFlag } from "./update-flag";

const flagEvents = (key: string) =>
  rows(
    "SELECT action, actor_kind, actor_user_id, workspace_id, metadata FROM audit_events WHERE target_type = 'feature_flag' AND target_id = ? ORDER BY occurred_at, rowid",
    key
  );

describe("updateFlag", () => {
  it("stores the switch and fallthrough and records feature_flag.updated", async () => {
    const memory = createMemoryFeatureFlags();
    expect(
      await updateFlag(
        { ...useCaseDeps(), flagStore: memory },
        {
          key: "upload-demo-presigned",
          enabled: true,
          fallthrough: false,
          actorUserId: "user-grace",
        }
      )
    ).toMatchObject({
      enabled: true,
      fallthrough: false,
      updatedBy: "user-grace",
    });
    expect(await flagEvents("upload-demo-presigned")).toEqual([
      {
        action: "feature_flag.updated",
        actor_kind: "admin",
        actor_user_id: "user-grace",
        workspace_id: null,
        metadata: JSON.stringify({ enabled: true, fallthrough: false }),
      },
    ]);
  });

  it("refuses flags outside the catalog and values of another type, recording nothing", async () => {
    const memory = createMemoryFeatureFlags();
    const deps = { ...useCaseDeps(), flagStore: memory };
    await expect(
      updateFlag(deps, {
        key: "dark-launch",
        enabled: true,
        fallthrough: null,
        actorUserId: "user-grace",
      })
    ).rejects.toMatchObject({ code: "UNKNOWN_FLAG" });
    await expect(
      updateFlag(deps, {
        key: "upload-demo-presigned",
        enabled: true,
        fallthrough: "yes",
        actorUserId: "user-grace",
      })
    ).rejects.toBeInstanceOf(FlagValueTypeError);
    expect(memory.flags.size).toBe(0);
    expect(await flagEvents("dark-launch")).toEqual([]);
    await expect(
      updateFlag(deps, {
        key: "dark-launch",
        enabled: true,
        fallthrough: null,
        actorUserId: "user-grace",
      })
    ).rejects.toBeInstanceOf(UnknownFlagError);
  });

  it("fails as unavailable without a store", async () => {
    await expect(
      updateFlag(
        { ...useCaseDeps(), flagStore: null },
        {
          key: "upload-demo-presigned",
          enabled: true,
          fallthrough: null,
          actorUserId: "user-grace",
        }
      )
    ).rejects.toBeInstanceOf(FlagStoreUnavailableError);
  });
});
