import { describe, expect, it } from "vitest";

import { createMemoryFeatureFlags } from "../platform";
import { FlagStoreUnavailableError } from "./domain";
import { listFlags } from "./list-flags";

describe("listFlags", () => {
  it("lists every catalog flag with its stored configuration, or null", async () => {
    const memory = createMemoryFeatureFlags();
    expect(await listFlags({ flagStore: memory })).toEqual([
      expect.objectContaining({
        key: "upload-demo-presigned",
        type: "boolean",
        default: true,
        owner: "platform",
        stored: null,
      }),
    ]);
    await memory.update(
      "upload-demo-presigned",
      { enabled: true, fallthrough: false },
      "user-grace"
    );
    await memory.update(
      "removed-from-catalog",
      { enabled: true, fallthrough: true },
      "user-grace"
    );
    const flags = await listFlags({ flagStore: memory });
    expect(flags.map((flag) => flag.key)).toEqual(["upload-demo-presigned"]);
    expect(flags[0]?.stored).toEqual({
      enabled: true,
      fallthrough: false,
      rules: [],
      updatedAt: "2026-10-28T12:00:00.000Z",
      updatedBy: "user-grace",
    });
  });

  it("shows a flag whose stored data does not parse as invalid, with the reason", async () => {
    const memory = createMemoryFeatureFlags({
      initial: [
        {
          key: "upload-demo-presigned",
          invalid: true,
          error: "Unexpected token 'o', \"on\" is not valid JSON",
          updatedAt: "2026-10-28T12:00:00.000Z",
          updatedBy: null,
        },
      ],
    });
    const [flag] = await listFlags({ flagStore: memory });
    expect(flag?.stored).toEqual({
      invalid: true,
      error: "Unexpected token 'o', \"on\" is not valid JSON",
      updatedAt: "2026-10-28T12:00:00.000Z",
      updatedBy: null,
    });
  });

  it("fails as unavailable without a store (FEATURE_FLAGS=none)", async () => {
    await expect(listFlags({ flagStore: null })).rejects.toBeInstanceOf(
      FlagStoreUnavailableError
    );
  });
});
