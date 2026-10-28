import { describe, expect, it } from "vitest";

import { flagContextFor } from "./flag-subject";

const subject = {
  userId: "user-ada",
  workspaceId: "ws-analytical",
  plan: null,
  environment: "production",
};

describe("flagContextFor", () => {
  it("buckets workspace rollouts by workspace, so members agree", () => {
    expect(flagContextFor("workspace", subject)).toEqual({
      targetingKey: "ws-analytical",
      ...subject,
    });
  });

  it("buckets user rollouts by user", () => {
    expect(flagContextFor("user", subject).targetingKey).toBe("user-ada");
  });

  it("has no targeting key when the id is missing", () => {
    expect(
      flagContextFor("workspace", { ...subject, workspaceId: null })
        .targetingKey
    ).toBeNull();
    expect(
      flagContextFor("user", { ...subject, userId: null }).targetingKey
    ).toBeNull();
  });
});
