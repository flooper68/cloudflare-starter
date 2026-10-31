import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { profileDeps } from "../../test/profile-fixtures";
import { purgeWorkspaceLogos } from "./purge-workspace-logos";

describe("purgeWorkspaceLogos", () => {
  it("preserves ownership and the settings contract", async () => {
    await env.FILES.put("workspaces/one/logo/old", "x");
    await env.FILES.put("workspaces/two/logo/keep", "x");
    await env.FILES.put("workspaces/one/files/keep", "x");
    await purgeWorkspaceLogos(profileDeps(), { workspaceIds: ["one"] });
    expect(await env.FILES.head("workspaces/one/logo/old")).toBeNull();
    expect(await env.FILES.head("workspaces/two/logo/keep")).not.toBeNull();
    expect(await env.FILES.head("workspaces/one/files/keep")).not.toBeNull();
  });
});
