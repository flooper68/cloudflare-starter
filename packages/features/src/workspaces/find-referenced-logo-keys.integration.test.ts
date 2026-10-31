import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { seedUser, seedWorkspace } from "../../test/fixtures";
import { profileDeps } from "../../test/profile-fixtures";
import { findReferencedLogoKeys } from "./find-referenced-logo-keys";

describe("findReferencedLogoKeys", () => {
  it("uses the logo reference index for a reconciliation batch", async () => {
    const plan = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT logo_key FROM workspaces WHERE logo_key IN (?, ?)"
    )
      .bind("workspaces/one/logo/current", "workspaces/two/logo/current")
      .all<{ detail: string }>();
    expect(plan.results.map((row) => row.detail).join(" ")).toContain(
      "USING COVERING INDEX workspaces_logo_key_idx"
    );
  });
  it("preserves ownership and the settings contract", async () => {
    const actor = await seedWorkspace((await seedUser()).id);
    const key = `workspaces/${actor.workspaceId}/logo/current`;
    await env.DB.prepare("UPDATE workspaces SET logo_key = ? WHERE id = ?")
      .bind(key, actor.workspaceId)
      .run();
    expect(
      await findReferencedLogoKeys(profileDeps(), [
        ...Array.from({ length: 60 }, (_, i) => `old-${i}`),
        key,
      ])
    ).toEqual(new Set([key]));
    expect(await findReferencedLogoKeys(profileDeps(), [])).toEqual(new Set());
  });
});
