import { describe, expect, it } from "vitest";

import { describeScopes } from "./oauth-scopes";

describe("describeScopes", () => {
  it("turns the MCP client's scopes into plain words, in a stable order", () => {
    expect(describeScopes("offline_access email openid profile")).toEqual([
      "Use the app's tools as you, in your workspaces",
      "See your name and profile picture",
      "See your email address",
      "Stay connected until you revoke it",
    ]);
  });

  it("shows unknown scopes as they are and drops duplicates", () => {
    expect(describeScopes("openid  openid files:write")).toEqual([
      "Use the app's tools as you, in your workspaces",
      'Scope "files:write"',
    ]);
  });

  it("still says what the client does when no scope is named", () => {
    expect(describeScopes("")).toEqual([
      "Use the app's tools as you, in your workspaces",
    ]);
  });
});
