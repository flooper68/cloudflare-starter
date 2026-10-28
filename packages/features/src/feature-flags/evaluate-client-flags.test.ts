import { describe, expect, it } from "vitest";

import { createMemoryFeatureFlags, noopFeatureFlags } from "../platform";
import { FLAGS } from "./domain";
import { evaluateClientFlags } from "./evaluate-client-flags";

const subject = {
  userId: "user-ada",
  workspaceId: "ws-analytical",
  plan: null,
  environment: "production",
};

describe("evaluateClientFlags", () => {
  it("returns the value of every client flag and nothing else", async () => {
    const clientKeys = Object.entries(FLAGS)
      .filter(([, definition]) => definition.client)
      .map(([key]) => key);
    const values = await evaluateClientFlags(
      { flags: noopFeatureFlags },
      subject
    );
    expect(Object.keys(values).sort()).toEqual(clientKeys.sort());
    expect(values).toEqual({ "upload-demo-presigned": true });
  });

  it("evaluates each flag for the subject", async () => {
    const memory = createMemoryFeatureFlags();
    await memory.update(
      "upload-demo-presigned",
      { enabled: true, fallthrough: false },
      "user-grace"
    );
    expect(await evaluateClientFlags({ flags: memory }, subject)).toEqual({
      "upload-demo-presigned": false,
    });
  });
});
