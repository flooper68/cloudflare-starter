import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { profileDeps } from "../../test/profile-fixtures";
import { purgeAccountImages } from "./purge-account-images";

describe("purgeAccountImages", () => {
  it("preserves ownership and the settings contract", async () => {
    const deps = profileDeps();
    await env.FILES.put("users/one/avatar/old", "a");
    await env.FILES.put("users/one/avatar/new", "b");
    await env.FILES.put("users/two/avatar/keep", "c");
    await purgeAccountImages(deps, { userId: "one" });
    expect(
      (await env.FILES.list({ prefix: "users/one/avatar/" })).objects
    ).toHaveLength(0);
    expect(await env.FILES.head("users/two/avatar/keep")).not.toBeNull();
  });
});
