import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  rows,
  seedUser,
  seedWorkspace,
  sequentialIds,
} from "../../test/fixtures";
import {
  gatedProfilePuts,
  png,
  profileDeps,
} from "../../test/profile-fixtures";
import { setWorkspaceLogo } from "./set-workspace-logo";

describe("setWorkspaceLogo", () => {
  it("preserves ownership and the settings contract", async () => {
    const user = await seedUser();
    const actor = await seedWorkspace(user.id);
    const deps = profileDeps();
    await expect(
      setWorkspaceLogo(
        deps,
        { ...actor, role: "member" },
        { bytes: png, contentType: "image/png" }
      )
    ).rejects.toThrow();
    const result = await setWorkspaceLogo(deps, actor, {
      bytes: png,
      contentType: "image/png",
    });
    expect(result.logoUrl).toContain(
      `/api/workspaces/${encodeURIComponent(actor.workspaceId)}/logo/`
    );
    const key = (
      await rows(
        "SELECT logo_key FROM workspaces WHERE id = ?",
        actor.workspaceId
      )
    )[0]?.logo_key as string;
    expect(await env.FILES.head(key)).not.toBeNull();
    await setWorkspaceLogo(deps, actor, {
      bytes: png,
      contentType: "image/png",
    });
    expect(await env.FILES.head(key)).toBeNull();
  });
});

it.each([
  [0, 1],
  [1, 0],
])(
  "concurrent logo publication (%s then %s) preserves the final image and other workspaces",
  async (first, last) => {
    const owner = await seedUser(`Concurrent logo ${first}`);
    const actor = await seedWorkspace(owner.id);
    const other = await seedWorkspace(
      (await seedUser(`Other logo ${first}`)).id
    );
    const deps = {
      ...profileDeps(),
      ids: sequentialIds(`1000000${first}-0000-4000-8000-`),
    };
    await setWorkspaceLogo(deps, actor, {
      bytes: png,
      contentType: "image/png",
    });
    await setWorkspaceLogo(deps, other, {
      bytes: png,
      contentType: "image/png",
    });
    const old = (
      await rows(
        "SELECT logo_key FROM workspaces WHERE id = ?",
        actor.workspaceId
      )
    )[0]?.logo_key as string;
    const untouched = (
      await rows(
        "SELECT logo_key FROM workspaces WHERE id = ?",
        other.workspaceId
      )
    )[0]?.logo_key as string;
    const gate = gatedProfilePuts(env.FILES);
    const content = [
      new Uint8Array([...png, 11]),
      new Uint8Array([...png, 22]),
    ];
    const pending = content.map((bytes) =>
      setWorkspaceLogo({ ...deps, bucket: gate.bucket }, actor, {
        bytes,
        contentType: "image/png",
      })
    );
    await gate.arrived(2);
    gate.writes.find((write) => write.body === content[first])?.release();
    await pending[first];
    gate.writes.find((write) => write.body === content[last])?.release();
    await pending[last];
    const current = (
      await rows(
        "SELECT logo_key FROM workspaces WHERE id = ?",
        actor.workspaceId
      )
    )[0]?.logo_key as string;
    expect(current).toBe(
      gate.writes.find((write) => write.body === content[last])?.key
    );
    const object = await env.FILES.get(current);
    expect(object).not.toBeNull();
    if (!object) throw new Error("The winning image was removed");
    expect(new Uint8Array(await object.arrayBuffer())).toEqual(content[last]);
    expect(await env.FILES.head(old)).toBeNull();
    expect(await env.FILES.head(untouched)).not.toBeNull();
    expect(
      (
        await rows(
          "SELECT logo_key FROM workspaces WHERE id = ?",
          other.workspaceId
        )
      )[0]?.logo_key
    ).toBe(untouched);
  }
);
